from django.http import HttpResponseForbidden
from functools import wraps

def role_required(allowed_roles):
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return HttpResponseForbidden("Not authenticated")
            
            user_role = getattr(request.user.profile, 'role', None)
            if user_role in allowed_roles or request.user.is_superuser:
                return view_func(request, *args, **kwargs)
            
            return HttpResponseForbidden("Access Denied: Insufficient Permissions")
        return _wrapped_view
    return decorator
