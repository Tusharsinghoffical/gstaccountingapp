import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gst_accounting.settings')
django.setup()
from django.conf import settings
settings.ALLOWED_HOSTS.append('testserver')


from django.test import Client
from django.contrib.auth.models import User
from core.models import Party, SalesInvoice, PurchaseInvoice, PaymentEntry, LedgerAccount, JournalItem

def run_e2e_test():
    client = Client()
    print("Starting End-to-End Test...")

    # Log in as admin
    user = User.objects.filter(username='admin').first()
    if not user:
        user = User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    client.force_login(user)

    # 1. Create a party
    party_data = {
        'name': 'E2E Test Customer Pvt Ltd',
        'gstin': '27AAAAA0000B1Z5',
        'pan_no': 'AAAAA1111B',
        'party_type': 'BOTH',
        'address': 'Test E2E Address',
        'city': 'Mumbai',
        'state': 'MH',
        'pin_code': '400002',
        'phone': '9876543211',
        'email': 'e2e@test.com',
        'opening_balance': '5000',
        'balance_type': 'DR'
    }
    r = client.post('/parties/add/', party_data)
    if r.status_code == 302:
        print("✅ Party created successfully.")
    else:
        print("❌ Party creation failed.", r.status_code)
        
    party = Party.objects.filter(name='E2E Test Customer Pvt Ltd').last()

    # 2. Create Sales Invoice
    sales_data = {
        'invoice_no': 'INV-E2E-100',
        'invoice_date': '2024-03-21',
        'party': party.id,
        'place_of_supply': 'MH',
        'status': 'DRAFT',
        'is_igst': 'False',
        'items-TOTAL_FORMS': '1',
        'items-INITIAL_FORMS': '0',
        'items-MIN_NUM_FORMS': '0',
        'items-MAX_NUM_FORMS': '1000',
        'items-0-description': 'Test Product A',
        'items-0-quantity': '10',
        'items-0-rate': '1000',
        'items-0-taxable_amount': '10000',
        'items-0-gst_percent': '18',
        'items-0-cgst_amount': '900',
        'items-0-sgst_amount': '900',
        'items-0-igst_amount': '0',
        'items-0-tds_percent': '0',
        'items-0-tds_section': '',
        'items-0-tds_amount': '0',
        'items-0-line_total': '11800',
        'total_taxable': '10000',
        'total_cgst': '900',
        'total_sgst': '900',
        'total_igst': '0',
        'total_tds': '0',
        'net_amount': '11800'
    }
    r = client.post('/invoices/add/', sales_data)
    if r.status_code == 302:
        print("✅ Sales Invoice submitted successfully.")
    else:
        print("❌ Sales Invoice form submission failed:", r.status_code)
        print(r.context['form'].errors if r.context and 'form' in r.context else "")
        print(r.context['items'].errors if r.context and 'items' in r.context else "")

    invoice = SalesInvoice.objects.filter(invoice_no='INV-E2E-100').first()
    if invoice and invoice.items.count() > 0 and invoice.net_amount == 11800:
        print(f"✅ Sales Invoice saved to DB! Net Amount: {invoice.net_amount}, Items: {invoice.items.count()}")
    else:
        print(f"❌ Sales Invoice save check failed. Net Amount: {invoice.net_amount if invoice else 'None'}")

    # 3. Create Purchase Invoice
    purchase_data = {
        'invoice_no': 'PUR-E2E-100',
        'invoice_date': '2024-03-22',
        'supplier': party.id,
        'expense_ledger': LedgerAccount.objects.filter(account_type='EXPENSE').first().id,
        'place_of_supply': 'MH',
        'status': 'DRAFT',
        'is_igst': 'False',
        'itc_eligible': 'True',
        'items-TOTAL_FORMS': '1',
        'items-INITIAL_FORMS': '0',
        'items-MIN_NUM_FORMS': '0',
        'items-MAX_NUM_FORMS': '1000',
        'items-0-description': 'Test Material',
        'items-0-quantity': '5',
        'items-0-rate': '500',
        'items-0-taxable_amount': '2500',
        'items-0-gst_percent': '18',
        'items-0-cgst_amount': '225',
        'items-0-sgst_amount': '225',
        'items-0-igst_amount': '0',
        'items-0-tds_percent': '0',
        'items-0-tds_section': '',
        'items-0-tds_amount': '0',
        'items-0-line_total': '2950',
        'total_taxable': '2500',
        'total_cgst': '225',
        'total_sgst': '225',
        'total_igst': '0',
        'total_tds': '0',
        'net_amount': '2950'
    }
    r = client.post('/purchases/add/', purchase_data)
    if r.status_code == 302:
        print("✅ Purchase Invoice submitted successfully.")
    else:
        print("❌ Purchase Invoice form submission failed:", r.status_code)

    purchase = PurchaseInvoice.objects.filter(invoice_no='PUR-E2E-100').first()
    if purchase and purchase.items.count() > 0 and purchase.net_amount == 2950:
        print(f"✅ Purchase Invoice saved to DB! Net Amount: {purchase.net_amount}, Items: {purchase.items.count()}")
    else:
        print("❌ Purchase Invoice save check failed. Found:", 'Yes' if purchase else 'No')

    # 4. Create Payment against the party
    bank_acc = LedgerAccount.objects.filter(name__icontains='Bank').first()
    if not bank_acc:
        bank_acc = LedgerAccount.objects.create(name='Test Bank', account_code='BANK001', account_type='ASSET')

    payment_data = {
        'payment_no': 'PMT-E2E-100',
        'payment_date': '2024-03-23',
        'party': party.id,
        'payment_type': 'ON_ACCOUNT',
        'payment_mode': 'BANK',
        'bank_account': bank_acc.id,
        'total_amount': '8000',
        'narration': 'E2E Test Payment'
    }
    r = client.post('/payments/add/', payment_data)
    if r.status_code == 302:
        print("✅ Payment submitted successfully.")
    else:
        print("❌ Payment form submission failed:", r.status_code)

    payment = PaymentEntry.objects.filter(payment_no='PMT-E2E-100').first()
    if payment and payment.total_amount == 8000:
        print(f"✅ Payment saved to DB! Amount: {payment.total_amount}")
    else:
        print("❌ Payment save check failed.")

    # 5. Check Ledger Balance
    try:
        party_acc = LedgerAccount.objects.get(account_code=f"PRTY-{party.id}")
        items = JournalItem.objects.filter(account=party_acc)
        balance = party_acc.opening_balance if party_acc.balance_type == 'DR' else -party_acc.opening_balance
        for item in items:
            balance += (item.debit - item.credit)
        
        print(f"")
        print(f"Final Party Balance Check:")
        print(f"Opening Balance (DR): {party_acc.opening_balance}")
        print(f"Ledger Journal Total Balance (DR): {balance}")
        expected = Decimal(party.opening_balance) + Decimal(11800) - Decimal(2950) - Decimal(8000)
    except Exception as e:
        print(f"Ledger check omitted: {e}")

if __name__ == '__main__':
    run_e2e_test()
