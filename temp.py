from backend.main import app
print([r.path for r in app.routes if 'settings' in r.path])