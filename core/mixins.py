from django.core.exceptions import PermissionDenied
from django.contrib.auth.mixins import AccessMixin

class AuditorReadOnlyMixin(AccessMixin):
    """
    Mixin that blocks Auditors from making changes.
    Only allows GET requests and blocks CreateView, UpdateView, DeleteView.
    """
    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return super().dispatch(request, *args, **kwargs)
            
        role = getattr(request.user.profile, 'role', None) if hasattr(request.user, 'profile') else None
        
        if role == 'AUDITOR':
            if request.method not in ['GET', 'HEAD', 'OPTIONS']:
                raise PermissionDenied("Auditors do not have permission to modify data.")
                
            class_names = [cls.__name__ for cls in self.__class__.__mro__]
            if 'CreateView' in class_names or 'UpdateView' in class_names or 'DeleteView' in class_names:
                raise PermissionDenied("Auditors cannot access data modification pages.")
                
        return super().dispatch(request, *args, **kwargs)

class AdminRequiredMixin(AccessMixin):
    """ Only ADMIN can access """
    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return super().dispatch(request, *args, **kwargs)
            
        if request.user.is_superuser:
            return super().dispatch(request, *args, **kwargs)
            
        role = getattr(request.user.profile, 'role', None) if hasattr(request.user, 'profile') else None
        if role != 'ADMIN':
             raise PermissionDenied("Only Administrators can perform this action.")
        return super().dispatch(request, *args, **kwargs)
