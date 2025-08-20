import firebase_admin
from firebase_admin import auth, credentials

# Point to the same service-account JSON the backend uses
cred = credentials.Certificate("backend/firebase-service-account.json")
firebase_admin.initialize_app(cred, {"projectId": "sdasite-a35a5"})

UID = "OYF9jUuSu8e821qRP86uIdyl7wf1"   # ← your uid
auth.set_custom_user_claims(UID, {"admin": True})
print("✅ admin claim applied")