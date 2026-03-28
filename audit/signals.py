from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import AuditLog
from core.models import SalesInvoice, PurchaseInvoice, PaymentEntry, Party, LedgerAccount, JournalEntry, JournalItem

def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

@receiver(post_save, sender=SalesInvoice)
@receiver(post_save, sender=PurchaseInvoice)
@receiver(post_save, sender=PaymentEntry)
@receiver(post_save, sender=Party)
@receiver(post_save, sender=LedgerAccount)
@receiver(post_save, sender=JournalEntry)
@receiver(post_save, sender=JournalItem)
def log_save(sender, instance, created, **kwargs):
    action = 'CREATE' if created else 'UPDATE'
    # In a real app, we'd use middleware to get the current user. 
    # For now, we'll log it without a user or handle it in views if needed.
    AuditLog.objects.create(
        action=action,
        model_name=sender.__name__,
        object_id=str(instance.pk),
        object_repr=str(instance)
    )

@receiver(post_delete, sender=SalesInvoice)
@receiver(post_delete, sender=PurchaseInvoice)
def log_delete(sender, instance, **kwargs):
    AuditLog.objects.create(
        action='DELETE',
        model_name=sender.__name__,
        object_id=str(instance.pk),
        object_repr=str(instance)
    )
