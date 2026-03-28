from .models import JournalEntry, JournalItem, LedgerAccount, SalesInvoice, PurchaseInvoice, PaymentEntry, PaymentAllocation
from django.db import transaction
from django.db.models import Sum
from datetime import date

def _get_sys_ledger(code):
    ledger = LedgerAccount.objects.filter(account_code=code, is_deleted=False).first()
    if ledger: return ledger
    defaults = {
        'SALE001': ('Sales', 'INCOME', 'CR'),
        'PURC001': ('Purchase', 'EXPENSE', 'DR'),
        'CGSTO001': ('CGST Output', 'LIABILITY', 'CR'),
        'SGSTO001': ('SGST Output', 'LIABILITY', 'CR'),
        'IGSTO001': ('IGST Output', 'LIABILITY', 'CR'),
        'CGSTI001': ('CGST Input', 'ASSET', 'DR'),
        'SGSTI001': ('SGST Input', 'ASSET', 'DR'),
        'IGSTI001': ('IGST Input', 'ASSET', 'DR'),
        'TDSR001': ('TDS Receivable', 'ASSET', 'DR'),
        'TDSP001': ('TDS Payable', 'LIABILITY', 'CR'),
        'CASH001': ('Cash', 'ASSET', 'DR'),
        'BANK001': ('Bank', 'ASSET', 'DR')
    }
    info = defaults.get(code, (f'System {code}', 'ASSET', 'DR'))
    return LedgerAccount.objects.create(
        account_code=code, name=info[0], account_type=info[1], balance_type=info[2], is_system=True
    )

def create_invoice_journal_entry(invoice):

    """
    Creates or updates the Journal Entry for a Sales Invoice.
    DR: Party Account (net_amount)
    CR: Sales Account (total_taxable)
    CR: CGST Output (total_cgst)
    CR: SGST Output (total_sgst)
    CR: IGST Output (total_igst)
    DR: TDS Receivable (total_tds)
    """
    with transaction.atomic():
        # Get or create entry
        entry, created = JournalEntry.objects.get_or_create(
            invoice=invoice,
            defaults={
                'date': invoice.invoice_date,
                'description': f"Sales Invoice {invoice.invoice_no}",
                'reference_no': invoice.reference_no
            }
        )
        
        if not created:
            entry.items.all().delete()
            entry.date = invoice.invoice_date
            entry.description = f"Sales Invoice {invoice.invoice_no}"
            entry.save()

        # 1. DR: Party Account
        party_ledger = LedgerAccount.objects.get(account_code=f"PRTY-{invoice.party.id}")
        JournalItem.objects.create(
            entry=entry,
            account=party_ledger,
            debit=invoice.net_amount,
            credit=0,
            narration=f"Amt due from {invoice.party.name}"
        )

        # 2. CR: Sales Account
        sales_acc = _get_sys_ledger('SALE001')
        JournalItem.objects.create(
            entry=entry,
            account=sales_acc,
            debit=0,
            credit=invoice.total_taxable,
            narration=f"Revenue from {invoice.invoice_no}"
        )

        # 3. CR: GST Output Accounts
        if invoice.total_cgst > 0:
            cgst_acc = _get_sys_ledger('CGSTO001')
            JournalItem.objects.create(entry=entry, account=cgst_acc, credit=invoice.total_cgst)
        
        if invoice.total_sgst > 0:
            sgst_acc = _get_sys_ledger('SGSTO001')
            JournalItem.objects.create(entry=entry, account=sgst_acc, credit=invoice.total_sgst)
            
        if invoice.total_igst > 0:
            igst_acc = _get_sys_ledger('IGSTO001')
            JournalItem.objects.create(entry=entry, account=igst_acc, credit=invoice.total_igst)

        # 4. DR: TDS Receivable
        if invoice.total_tds > 0:
            tds_acc = _get_sys_ledger('TDSR001')
            JournalItem.objects.create(entry=entry, account=tds_acc, debit=invoice.total_tds)

    return entry

def create_purchase_journal_entry(invoice):
    """
    Creates or updates the Journal Entry for a Purchase Invoice.
    DR: Expense/Stock Account (total_taxable)
    DR: GST Input (if ITC eligible)
    CR: Supplier Account (net_amount)
    CR: TDS Payable (total_tds)
    If RCM: CR GST Liability (Output) logic
    """
    with transaction.atomic():
        entry, created = JournalEntry.objects.get_or_create(
            reference_no=f"PUR-{invoice.id}",
            defaults={
                'date': invoice.invoice_date,
                'description': f"Purchase Invoice {invoice.invoice_no}",
            }
        )
        
        if not created:
            entry.items.all().delete()
            entry.date = invoice.invoice_date
            entry.description = f"Purchase Invoice {invoice.invoice_no}"
            entry.save()

        # 1. DR: Expense/Stock Account
        acc = invoice.expense_ledger or invoice.stock_ledger or _get_sys_ledger('PURC001')
        JournalItem.objects.create(
            entry=entry,
            account=acc,
            debit=invoice.total_taxable,
            credit=0,
            narration=f"Purchase from {invoice.supplier.name}"
        )

        # 2. DR: GST Input (if ITC eligible)
        if invoice.itc_eligible:
            if invoice.total_cgst > 0:
                acc = _get_sys_ledger('CGSTI001')
                JournalItem.objects.create(entry=entry, account=acc, debit=invoice.total_cgst)
            if invoice.total_sgst > 0:
                acc = _get_sys_ledger('SGSTI001')
                JournalItem.objects.create(entry=entry, account=acc, debit=invoice.total_sgst)
            if invoice.total_igst > 0:
                acc = _get_sys_ledger('IGSTI001')
                JournalItem.objects.create(entry=entry, account=acc, debit=invoice.total_igst)

        # 3. CR: Supplier Account
        supplier_ledger = LedgerAccount.objects.get(account_code=f"PRTY-{invoice.supplier.id}")
        JournalItem.objects.create(
            entry=entry,
            account=supplier_ledger,
            debit=0,
            credit=invoice.net_amount,
            narration=f"Amt due to {invoice.supplier.name}"
        )

        # 4. CR: TDS Payable
        if invoice.total_tds > 0:
            tds_acc = _get_sys_ledger('TDSP001')
            JournalItem.objects.create(entry=entry, account=tds_acc, credit=invoice.total_tds)

        # 5. RCM Logic: if RCM applies, we create a GST liability even if we don't pay supplier tax
        if invoice.rcm_applicable:
             # In RCM, we pay tax to Govt. So CR: GST Output
             if invoice.total_cgst > 0:
                 acc = _get_sys_ledger('CGSTO001')
                 JournalItem.objects.create(entry=entry, account=acc, credit=invoice.total_cgst, narration="RCM Liability")
             # ... similar for SGST/IGST
             
    return entry

def update_invoice_payment_status(invoice_type, invoice_id):
    """Recalculates paid/received amounts and updates status."""
    if invoice_type == 'SALES':
        invoice = SalesInvoice.objects.get(pk=invoice_id)
        total_paid = PaymentAllocation.objects.filter(sales_invoice=invoice, payment__is_deleted=False).aggregate(Sum('allocated_amount'))['allocated_amount__sum'] or 0
        invoice.amount_received = total_paid
        if invoice.amount_received >= invoice.net_amount:
            invoice.status = 'PAID'
        elif invoice.amount_received > 0:
            invoice.status = 'PART_PAID'
        elif invoice.due_date and invoice.due_date < date.today():
            invoice.status = 'OVERDUE'
        else:
            invoice.status = 'SENT'
        invoice.save()
    else:
        invoice = PurchaseInvoice.objects.get(pk=invoice_id)
        total_paid = PaymentAllocation.objects.filter(purchase_invoice=invoice, payment__is_deleted=False).aggregate(Sum('allocated_amount'))['allocated_amount__sum'] or 0
        invoice.amount_paid = total_paid
        if invoice.amount_paid >= invoice.net_amount:
            invoice.status = 'PAID'
        elif invoice.amount_paid > 0:
            invoice.status = 'PART_PAID'
        elif invoice.due_date and invoice.due_date < date.today():
             invoice.status = 'OVERDUE'
        else:
            invoice.status = 'DRAFT'
        invoice.save()

def _get_party_ledger(party):
    """Get or create a ledger account for a party."""
    code = f"PRTY-{party.id}"
    ledger = LedgerAccount.objects.filter(account_code=code, is_deleted=False).first()
    if ledger:
        return ledger
    # Determine account type based on party_type
    if party.party_type == 'SUPPLIER':
        acc_type, bal_type = 'LIABILITY', 'CR'
    else:
        acc_type, bal_type = 'ASSET', 'DR'
    return LedgerAccount.objects.create(
        account_code=code,
        name=party.name,
        account_type=acc_type,
        balance_type=bal_type,
        is_system=False
    )

def create_payment_journal_entry(payment):
    """
    Creates Journal Entry for Payment/Receipt.
    Receipt (Customer): DR Bank/Cash, CR Party
    Payment (Supplier): DR Party, CR Bank/Cash
    """
    with transaction.atomic():
        entry, created = JournalEntry.objects.get_or_create(
            reference_no=f"PAY-{payment.id}",
            defaults={
                'date': payment.payment_date,
                'description': f"Payment {payment.payment_no} - {payment.party.name}",
            }
        )
        if not created:
            entry.items.all().delete()

        party_ledger = _get_party_ledger(payment.party)
        bank_ledger = payment.bank_account if payment.bank_account else _get_sys_ledger('CASH001')

        amount = payment.total_amount or 0

        # Receipt if any sales allocations exist, otherwise check party type
        has_sales_alloc = payment.allocations.filter(invoice_type='SALES').exists()
        is_receipt = has_sales_alloc or payment.party.party_type in ('CUSTOMER', 'BOTH')

        if is_receipt:
            # Money coming IN: DR Bank, CR Party (Customer)
            JournalItem.objects.create(entry=entry, account=bank_ledger, debit=amount)
            JournalItem.objects.create(entry=entry, account=party_ledger, credit=amount)
        else:
            # Money going OUT: DR Party (Supplier), CR Bank
            JournalItem.objects.create(entry=entry, account=party_ledger, debit=amount)
            JournalItem.objects.create(entry=entry, account=bank_ledger, credit=amount)

        return entry