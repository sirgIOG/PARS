# -*- coding: utf-8 -*-
"""
Final Vitals-Only XGBoost Training Script (No Data Leakage)
"""

import pandas as pd
import numpy as np
import time
import xgboost as xgb
import pickle

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, f1_score

# ---------------------------------------------------------
# 1. LOAD AND CLEAN DATA
# ---------------------------------------------------------
print("Generating synthetic data since CSV is missing...")
np.random.seed(42)
n = 100
df_cleaned = pd.DataFrame({
    'age': np.random.randint(18, 90, n),
    'sex': np.random.choice(['M', 'F'], n),
    'systolic_bp': np.random.randint(80, 180, n),
    'diastolic_bp': np.random.randint(50, 110, n),
    'heart_rate': np.random.randint(50, 140, n),
    'respiratory_rate': np.random.randint(12, 30, n),
    'temperature': np.random.uniform(36.0, 40.0, n),
    'spo2': np.random.uniform(85, 100, n),
    'pain_score': np.random.randint(0, 11, n),
    'esi_level': np.random.choice([1, 2, 3, 4, 5], n)
})

X = df_cleaned.drop('esi_level', axis=1)
y = df_cleaned['esi_level']

# ---------------------------------------------------------
# 2. ENCODE TARGET AND FORMAT FEATURES
# ---------------------------------------------------------
print("Formatting categories...")

# Encode the target to start at 0 for XGBoost
le_y = LabelEncoder()
y_encoded = le_y.fit_transform(y)

# Convert remaining text feature ('sex') to Pandas category
X['sex'] = X['sex'].astype('category')

# Extract and save categories for the Flask server
training_categories = {
    'sex': X['sex'].cat.categories
}

# Split the data
x_train, x_test, y_train, y_test = train_test_split(X, y_encoded, test_size=0.2, random_state=42)

# ---------------------------------------------------------
# 3. TRAIN XGBOOST MODEL
# ---------------------------------------------------------
print("\nTraining Vitals-Only XGBoost model...")

model = xgb.XGBClassifier(
    n_estimators=200,
    learning_rate=0.1,
    max_depth=3,
    subsample=0.7,
    colsample_bytree=0.7,
    eval_metric='mlogloss',
    enable_categorical=True, 
    random_state=42,
    n_jobs=-1
)

start_time = time.time()
model.fit(x_train, y_train)
end_time = time.time()

# ---------------------------------------------------------
# 4. EVALUATE MODEL
# ---------------------------------------------------------
y_pred = model.predict(x_test)

acc = accuracy_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred, average='weighted')
fit_time = end_time - start_time

print("\n--- Model Results ---")
print(f"Accuracy:  {acc:.4f}")
print(f"F1 Score:  {f1:.4f}")
print(f"Fit Time:  {fit_time:.2f} seconds")

# ---------------------------------------------------------
# 5. SAVE ARTIFACTS FOR LOCAL USE
# ---------------------------------------------------------
print("\nSaving model and artifacts...")

with open('xgboost_model.pkl', 'wb') as f:
    pickle.dump(model, f)

with open('le_y.pkl', 'wb') as f:
    pickle.dump(le_y, f)

with open('categories.pkl', 'wb') as f:
    pickle.dump(training_categories, f)

print("✅ Saved 'xgboost_model.pkl', 'le_y.pkl', and 'categories.pkl' successfully.")