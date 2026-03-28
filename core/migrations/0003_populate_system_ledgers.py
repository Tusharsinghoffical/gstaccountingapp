from django.db import migrations

def create_system_ledgers(apps, schema_editor):
    LedgerAccount = apps.get_model('core', 'LedgerAccount')
    
    system_accounts = [
        ('Cash', 'CASH001', 'ASSET', 'DR'),
        ('Bank', 'BANK001', 'ASSET', 'DR'),
        ('Sales', 'SALE001', 'INCOME', 'CR'),
        ('Purchase', 'PURC001', 'EXPENSE', 'DR'),
        ('CGST Output', 'CGSTO001', 'LIABILITY', 'CR'),
        ('SGST Output', 'SGSTO001', 'LIABILITY', 'CR'),
        ('IGST Output', 'IGSTO001', 'LIABILITY', 'CR'),
        ('CGST Input', 'CGSTI001', 'ASSET', 'DR'),
        ('SGST Input', 'SGSTI001', 'ASSET', 'DR'),
        ('IGST Input', 'IGSTI001', 'ASSET', 'DR'),
        ('TDS Receivable', 'TDSR001', 'ASSET', 'DR'),
        ('TDS Payable', 'TDSP001', 'LIABILITY', 'CR'),
    ]
    
    for name, code, acc_type, bal_type in system_accounts:
        LedgerAccount.objects.update_or_create(
            account_code=code,
            defaults={
                'name': name,
                'account_type': acc_type,
                'balance_type': bal_type,
                'is_system': True
            }
        )

def remove_system_ledgers(apps, schema_editor):
    LedgerAccount = apps.get_model('core', 'LedgerAccount')
    LedgerAccount.objects.filter(is_system=True).delete()

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_party_ledgeraccount'),
    ]

    operations = [
        migrations.RunPython(create_system_ledgers, remove_system_ledgers),
    ]
