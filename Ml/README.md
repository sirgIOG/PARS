# ML Model - ED Triage Risk Scoring

This module contains a machine learning model for Emergency Department (ED) patient triage using XGBoost. The model predicts ESI (Emergency Severity Index) levels (1-5) based on patient vital signs.

## Model Overview

### Purpose
The model provides automated triage classification to help prioritize patient care in emergency departments. It predicts ESI levels which indicate the severity and urgency of a patient's condition.

### Algorithm: XGBoost Classifier
- **Type**: Gradient Boosting Ensemble
- **Target**: ESI Level (1-5 classification)
- **Input Features**: Patient vital signs only (vitals-only approach to prevent data leakage)

### Model Performance
- **Accuracy**: ~70-75% (varies based on dataset)
- **Training Time**: ~2-5 seconds
- **Feature Count**: 7 vital sign features

## Input Features

The model uses the following patient vital signs:

| Feature | Unit | Type | Description |
|---------|------|------|-------------|
| `age` | years | numeric | Patient age |
| `sex` | categorical | M/F | Patient gender |
| `systolic_bp` | mmHg | numeric | Systolic blood pressure |
| `diastolic_bp` | mmHg | numeric | Diastolic blood pressure |
| `heart_rate` | bpm | numeric | Heart rate |
| `respiratory_rate` | breaths/min | numeric | Breathing rate |
| `temperature` | °C | numeric | Body temperature |
| `spo2` | % | numeric | Blood oxygen saturation |
| `pain_score` | 0-10 | numeric | Patient self-reported pain |

## Output

The model returns an **ESI Level** (1-5):
- **ESI-1**: Resuscitation required
- **ESI-2**: Emergent - high-risk situations
- **ESI-3**: Emergent - moderate-risk situations
- **ESI-4**: Urgent
- **ESI-5**: Non-urgent

## Project Structure

```
ML/
├── README.md                              # This file
├── models/
│   ├── connection.py                      # Flask API server
│   ├── xgboost_model.pkl                  # Trained model (generated)
│   ├── le_y.pkl                           # Label encoder (generated)
│   └── categories.pkl                     # Feature categories (generated)
└── training/
    ├── train.py                           # Training script
    ├── fedmml_ed_triage_dataset.csv       # Training dataset
    ├── xgboost_model.pkl                  # Saved model
    ├── le_y.pkl                           # Saved label encoder
    └── categories.pkl                     # Saved categories
```

## Setup & Installation

### Prerequisites
- Python 3.8+
- pip or conda

### Step 1: Install Dependencies

```bash
pip install pandas numpy scikit-learn xgboost flask python-dotenv
```

### Step 2: Navigate to ML Directory

```bash
cd ML
```

## Training the Model

### Run the Training Script

```bash
cd training
python train.py
```

This will:
1. Load and clean the training dataset (`fedmml_ed_triage_dataset.csv`)
2. Remove data leakage columns (lab results, clinical notes, etc.)
3. Train XGBoost on vital signs only
4. Generate performance metrics (Accuracy, F1 Score)
5. Save three artifact files:
   - `xgboost_model.pkl` - The trained model
   - `le_y.pkl` - Label encoder for ESI levels
   - `categories.pkl` - Feature categories dictionary

### Expected Output

```
Loading and cleaning data...
Formatting categories...

Training Vitals-Only XGBoost model...

--- Model Results ---
Accuracy:  0.7234
F1 Score:  0.7156
Fit Time:  2.45 seconds

Saving model and artifacts...
✅ Saved 'xgboost_model.pkl', 'le_y.pkl', and 'categories.pkl' successfully.
```

## Running the API Server

### Start the Flask Server

```bash
cd models
python connection.py
```

The server will start on `http://localhost:8000` by default.

### Configuration

Set the PORT environment variable to change the server port (optional):

```bash
set PORT=5000  # Windows
export PORT=5000  # Mac/Linux
python connection.py
```

### API Endpoint

**POST** `/predict`

#### Request Format
```json
{
  "age": 45,
  "sex": "M",
  "systolic_bp": 120,
  "diastolic_bp": 80,
  "heart_rate": 75,
  "respiratory_rate": 16,
  "temperature": 37.0,
  "spo2": 98,
  "pain_score": 5
}
```

#### Response Format (Success)
```json
{
  "status": "success",
  "predicted_esi_level": "3"
}
```

#### Response Format (Error)
```json
{
  "status": "error",
  "message": "Error description"
}
```

### Example Usage with cURL

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "age": 45,
    "sex": "M",
    "systolic_bp": 120,
    "diastolic_bp": 80,
    "heart_rate": 75,
    "respiratory_rate": 16,
    "temperature": 37.0,
    "spo2": 98,
    "pain_score": 5
  }'
```

### Example Usage with Python (Axios equivalent)

```python
import requests

data = {
    "age": 45,
    "sex": "M",
    "systolic_bp": 120,
    "diastolic_bp": 80,
    "heart_rate": 75,
    "respiratory_rate": 16,
    "temperature": 37.0,
    "spo2": 98,
    "pain_score": 5
}

response = requests.post('http://localhost:8000/predict', json=data)
print(response.json())
```

## Important Notes

### Data Leakage Prevention
The model uses **vitals-only** approach to prevent data leakage. The following columns are excluded:
- **Identifiers**: encounter_id, patient_id, site_id, country
- **Clinical Notes**: chief_complaint, clinical_notes
- **Lab Results**: wbc, hemoglobin, platelet_count, sodium, potassium, creatinine, glucose, troponin, bnp, lactate, inr
- **Timestamps**: arrival_timestamp

This ensures the model can make real-time predictions at early triage stages before lab results are available.

### Model Artifacts
The three pickle files must be kept together:
- `xgboost_model.pkl` - The actual trained model
- `le_y.pkl` - Encoder to convert ESI levels back to original format (1-5)
- `categories.pkl` - Feature categories (sex: M/F mapping)

### Feature Order
The Flask server automatically ensures features are in the correct order for prediction. The order must match the training data order.

## Workflow

### Complete Workflow Example

1. **Train the model**:
   ```bash
   cd training
   python train.py
   ```

2. **Copy artifacts to deployment location** (if using separate directories):
   ```bash
   cp xgboost_model.pkl ../models/
   cp le_y.pkl ../models/
   cp categories.pkl ../models/
   ```

3. **Start the API server**:
   ```bash
   cd models
   python connection.py
   ```

4. **Make predictions** via HTTP POST requests to `/predict` endpoint

## Troubleshooting

### Issue: "FileNotFoundError: xgboost_model.pkl"
**Solution**: Make sure you've run `train.py` first to generate the PKL files, and they're in the same directory as `connection.py`.

### Issue: "KeyError: Feature mismatch"
**Solution**: Ensure all required features are present in the request and match the training feature names exactly.

### Issue: Model not loading/Server won't start
**Solution**: 
1. Verify Python and dependencies are installed: `pip install -r requirements.txt`
2. Check that all three PKL files exist in the models directory
3. Verify write permissions in the directory

## Future Improvements

- Add confidence scores to predictions
- Implement feature importance analysis
- Add callback endpoints for batch predictions
- Implement model versioning and A/B testing
- Add logging and monitoring
- Deploy with Docker containerization

## References

- ESI Triage Algorithm: https://www.ahrq.gov/professionals/systems/hospital/esi/index.html
- XGBoost Documentation: https://xgboost.readthedocs.io/
- Flask Documentation: https://flask.palletsprojects.com/
