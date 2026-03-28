from .models import UserProfile
from django.conf import settings
from datetime import datetime

def user_role_context(request):
    if request.user.is_authenticated:
        try:
            user_role = request.user.profile.role
        except UserProfile.DoesNotExist:
            user_role = None
    else:
        user_role = None

    return {
        'user_role': user_role,
        'app_version': getattr(settings, 'APP_VERSION', '1.0.0'),
        'current_year': datetime.now().year,
    }
