from flask import Flask, request, jsonify
import pandas as pd
from pandas.api.types import CategoricalDtype
import pickle
import os
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file

app = Flask(__name__)

# ---------------------------------------------------------
# 1. LOAD ARTIFACTS ON STARTUP
# ---------------------------------------------------------
print("Loading model, encoder, and categories...")
try:
    with open('xgboost_model.pkl', 'rb') as f:
        model = pickle.load(f)
    
    with open('le_y.pkl', 'rb') as f:
        le_y = pickle.load(f)
        
    with open('categories.pkl', 'rb') as f:
        saved_categories = pickle.load(f)
        
    # Rebuild the exact category datatype for 'sex'
    sex_type = CategoricalDtype(categories=saved_categories['sex'], ordered=False)
    
    print("✅ All artifacts loaded. Ready to receive live data!")
    
except FileNotFoundError as e:
    print(f"❌ Error: {e}")
    print("Please ensure your three .pkl files are in the same directory as this script.")
    exit()

# ---------------------------------------------------------
# 2. DEFINE THE API ENDPOINT
# ---------------------------------------------------------
@app.route('/predict', methods=['POST'])
def predict():
    try:
        # Get JSON data from Axios
        patient_data = request.json
        
        # Convert to a single-row DataFrame
        df = pd.DataFrame([patient_data])
        
        # Apply the exact categorical type from training
        df['sex'] = df['sex'].astype(sex_type)
        
        # Ensure columns are in the exact same order as training
        expected_columns = model.feature_names_in_
        df = df[expected_columns]
        
        # Predict
        pred_encoded = model.predict(df)
        
        # Decode target back to actual ESI Level (1-5)
        pred_label = le_y.inverse_transform(pred_encoded)[0]
        
        return jsonify({
            'status': 'success',
            'predicted_esi_level': int(pred_label)
        }), 200

    except Exception as e:
        return jsonify({
            'status': 'error', 
            'message': str(e)
        }), 400

# ---------------------------------------------------------
# 3. RUN THE SERVER
# ---------------------------------------------------------
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=os.getenv("PORT",8000), debug=True)