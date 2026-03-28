from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import LedgerAccount


class Command(BaseCommand):
    help = 'Create default chart of accounts for all users'

    def handle(self, *args, **options):
        users = User.objects.all()

        if not users:
            self.stdout.write(self.style.WARNING('No users found'))
            return

        system_accounts = [
            # Assets
            ('Cash', 'CASH001', 'ASSET', 'DR'),
            ('Bank', 'BANK001', 'ASSET', 'DR'),

            # Income
            ('Sales', 'SALE001', 'INCOME', 'CR'),
            ('Service Income', 'SINC001', 'INCOME', 'CR'),

            # Expenses
            ('Purchase', 'PURC001', 'EXPENSE', 'DR'),
            ('Office Expenses', 'OFFE001', 'EXPENSE', 'DR'),
            ('Salary', 'SALA001', 'EXPENSE', 'DR'),
            ('Rent', 'RENT001', 'EXPENSE', 'DR'),
            ('Electricity', 'ELEC001', 'EXPENSE', 'DR'),
            ('Telephone', 'TELE001', 'EXPENSE', 'DR'),
            ('Transport', 'TRAN001', 'EXPENSE', 'DR'),
            ('Marketing', 'MARK001', 'EXPENSE', 'DR'),
            ('Professional Fees', 'PROF001', 'EXPENSE', 'DR'),
            ('Bank Charges', 'BNCH001', 'EXPENSE', 'DR'),
            ('Printing & Stationery', 'PRST001', 'EXPENSE', 'DR'),
            ('Repairs & Maintenance', 'RAMA001', 'EXPENSE', 'DR'),
            ('Insurance', 'INSU001', 'EXPENSE', 'DR'),
            ('Depreciation', 'DEPR001', 'EXPENSE', 'DR'),

            # GST Liabilities
            ('CGST Output', 'CGSTO001', 'LIABILITY', 'CR'),
            ('SGST Output', 'SGSTO001', 'LIABILITY', 'CR'),
            ('IGST Output', 'IGSTO001', 'LIABILITY', 'CR'),
            ('CGST Input', 'CGSTI001', 'ASSET', 'DR'),
            ('SGST Input', 'SGSTI001', 'ASSET', 'DR'),
            ('IGST Input', 'IGSTI001', 'ASSET', 'DR'),

            # TDS
            ('TDS Receivable', 'TDSR001', 'ASSET', 'DR'),
            ('TDS Payable', 'TDSP001', 'LIABILITY', 'CR'),
        ]

        total_created = 0

        for user in users:
            user_ledger_count = LedgerAccount.objects.filter(user=user).count()

            if user_ledger_count == 0:
                self.stdout.write(
                    f'Creating chart of accounts for {user.username}...')

                for name, code, acc_type, bal_type in system_accounts:
                    # Check if this code exists for THIS user
                    if not LedgerAccount.objects.filter(user=user, account_code=code).exists():
                        LedgerAccount.objects.create(
                            user=user,
                            account_code=code,
                            name=name,
                            account_type=acc_type,
                            balance_type=bal_type,
                            is_system=True
                        )
                        total_created += 1

                self.stdout.write(self.style.SUCCESS(
                    f'  ✓ Created {len(system_accounts)} ledger accounts for {user.username}'
                ))
            else:
                # Check if essential accounts exist
                essential_codes = ['PURC001', 'CASH001', 'BANK001', 'SALE001']
                existing_codes = list(LedgerAccount.objects.filter(
                    user=user,
                    account_code__in=essential_codes
                ).values_list('account_code', flat=True))

                missing_codes = [
                    c for c in essential_codes if c not in existing_codes]

                if missing_codes:
                    self.stdout.write(
                        f'Adding missing accounts for {user.username}...')
                    for code in missing_codes:
                        acc_data = next(
                            (acc for acc in system_accounts if acc[1] == code), None)
                        if acc_data:
                            # Check if exists for this user
                            if not LedgerAccount.objects.filter(user=user, account_code=code).exists():
                                LedgerAccount.objects.create(
                                    user=user,
                                    account_code=code,
                                    name=acc_data[0],
                                    account_type=acc_data[2],
                                    balance_type=acc_data[3],
                                    is_system=True
                                )
                                total_created += 1

        self.stdout.write(self.style.SUCCESS(
            f'\n✅ Total ledger accounts created/updated: {total_created}'
        ))
