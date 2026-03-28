from django.db import models, transaction
from django.core.validators import RegexValidator
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User


class UserProfile(models.Model):
    ROLES = [
        ('ADMIN', 'Admin'),
        ('ACCOUNTANT', 'Accountant'),
        ('AUDITOR', 'Auditor'),
    ]
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLES, default='ACCOUNTANT')
    phone = models.CharField(max_length=15, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)


INDIAN_STATES = [
    ('AN', 'Andaman and Nicobar Islands'),
    ('AP', 'Andhra Pradesh'),
    ('AR', 'Arunachal Pradesh'),
    ('AS', 'Assam'),
    ('BR', 'Bihar'),
    ('CH', 'Chandigarh'),
    ('CT', 'Chhattisgarh'),
    ('DN', 'Dadra and Nagar Haveli and Daman and Diu'),
    ('DL', 'Delhi'),
    ('GA', 'Goa'),
    ('GJ', 'Gujarat'),
    ('HR', 'Haryana'),
    ('HP', 'Himachal Pradesh'),
    ('JK', 'Jammu and Kashmir'),
    ('JH', 'Jharkhand'),
    ('KA', 'Karnataka'),
    ('KL', 'Kerala'),
    ('LA', 'Ladakh'),
    ('LD', 'Lakshadweep'),
    ('MP', 'Madhya Pradesh'),
    ('MH', 'Maharashtra'),
    ('MN', 'Manipur'),
    ('ML', 'Meghalaya'),
    ('MZ', 'Mizoram'),
    ('NL', 'Nagaland'),
    ('OR', 'Odisha'),
    ('PY', 'Puducherry'),
    ('PB', 'Punjab'),
    ('RJ', 'Rajasthan'),
    ('SK', 'Sikkim'),
    ('TN', 'Tamil Nadu'),
    ('TG', 'Telangana'),
    ('TR', 'Tripura'),
    ('UP', 'Uttar Pradesh'),
    ('UT', 'Uttarakhand'),
    ('WB', 'West Bengal'),
]


class CompanyProfile(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='company_profiles')
    company_name = models.CharField(max_length=255)
    establishment_date = models.DateField()
    cin_no = models.CharField(max_length=21, blank=True, null=True)
    gst_no = models.CharField(
        max_length=15,
        validators=[
            RegexValidator(
                regex=r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
                message='Invalid GSTIN format'
            )
        ]
    )
    pan_no = models.CharField(
        max_length=10,
        validators=[
            RegexValidator(
                regex=r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$',
                message='Invalid PAN format'
            )
        ]
    )
    address = models.TextField()
    state = models.CharField(max_length=2, choices=INDIAN_STATES)
    pin_code = models.CharField(
        max_length=6,
        validators=[
            RegexValidator(
                regex=r'^\d{6}$',
                message='Pin code must be 6 digits'
            )
        ]
    )
    phone_no = models.CharField(max_length=15)
    email = models.EmailField()
    logo = models.ImageField(upload_to='company_logos/', blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.company_name

    class Meta:
        verbose_name = "Company Profile"
        verbose_name_plural = "Company Profiles"


class Party(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='parties')
    PARTY_TYPES = [
        ('CUSTOMER', 'Customer'),
        ('SUPPLIER', 'Supplier'),
        ('BOTH', 'Both'),
    ]

    BALANCE_TYPES = [
        ('DR', 'Debit'),
        ('CR', 'Credit'),
    ]

    name = models.CharField(max_length=255)
    gstin = models.CharField(
        max_length=15,
        validators=[
            RegexValidator(
                regex=r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
                message='Invalid GSTIN format'
            )
        ],
        blank=True, null=True
    )
    pan_no = models.CharField(
        max_length=10,
        validators=[
            RegexValidator(
                regex=r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$',
                message='Invalid PAN format'
            )
        ],
        blank=True, null=True
    )
    party_type = models.CharField(max_length=10, choices=PARTY_TYPES)
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=2, choices=INDIAN_STATES)
    pin_code = models.CharField(
        max_length=6,
        validators=[RegexValidator(
            regex=r'^\d{6}$', message='Pin code must be 6 digits')]
    )
    phone = models.CharField(max_length=15, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)

    opening_balance = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    balance_type = models.CharField(
        max_length=2, choices=BALANCE_TYPES, default='DR')

    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


@receiver(post_save, sender=Party)
def create_party_ledger(sender, instance, created, **kwargs):
    if created:
        from .models import LedgerAccount
        # Determine account type based on party type
        acc_type = 'ASSET' if instance.party_type == 'CUSTOMER' else 'LIABILITY'
        if instance.party_type == 'BOTH':
            acc_type = 'ASSET'  # Default to asset for 'BOTH' or handle separately

        LedgerAccount.objects.get_or_create(
            account_code=f"PRTY-{instance.id}",
            defaults={
                'name': instance.name,
                'account_type': acc_type,
                'opening_balance': instance.opening_balance,
                'balance_type': instance.balance_type,
            }
        )

    class Meta:
        verbose_name_plural = "Parties"


class LedgerAccount(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='ledger_accounts')
    ACCOUNT_TYPES = [
        ('ASSET', 'Asset'),
        ('LIABILITY', 'Liability'),
        ('INCOME', 'Income'),
        ('EXPENSE', 'Expense'),
        ('EQUITY', 'Equity'),
    ]

    BALANCE_TYPES = [
        ('DR', 'Debit'),
        ('CR', 'Credit'),
    ]

    name = models.CharField(max_length=255)
    account_code = models.CharField(max_length=50, unique=True)
    account_type = models.CharField(max_length=10, choices=ACCOUNT_TYPES)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL,
                               null=True, blank=True, related_name='sub_accounts')

    opening_balance = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    balance_type = models.CharField(
        max_length=2, choices=BALANCE_TYPES, default='DR')

    is_system = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.account_code})"


class SalesInvoice(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='sales_invoices')
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('SENT', 'Sent'),
        ('PART_PAID', 'Partially Paid'),
        ('PAID', 'Paid'),
        ('OVERDUE', 'Overdue'),
    ]

    invoice_no = models.CharField(max_length=50, unique=True)
    invoice_date = models.DateField()
    party = models.ForeignKey(
        Party, on_delete=models.PROTECT, related_name='invoices')

    # Auto-filled from party for snapshot consistency
    gstin = models.CharField(max_length=15, blank=True, null=True)
    pan_no = models.CharField(max_length=10, blank=True, null=True)
    state = models.CharField(max_length=2, choices=INDIAN_STATES)
    place_of_supply = models.CharField(max_length=2, choices=INDIAN_STATES)
    is_igst = models.BooleanField(default=False)

    due_date = models.DateField(blank=True, null=True)
    payment_terms = models.TextField(blank=True, null=True)
    narration = models.TextField(blank=True, null=True)
    reference_no = models.CharField(max_length=100, blank=True, null=True)

    # Totals
    total_taxable = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    total_cgst = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    total_sgst = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    total_igst = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    total_tds = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    amount_received = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)

    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default='DRAFT')
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.invoice_no


class SalesInvoiceItem(models.Model):
    invoice = models.ForeignKey(
        SalesInvoice, on_delete=models.CASCADE, related_name='items')
    description = models.CharField(max_length=255)
    hsn_sac = models.CharField(max_length=10, blank=True, null=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    taxable_amount = models.DecimalField(max_digits=12, decimal_places=2)

    gst_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0)
    cgst_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    sgst_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    igst_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)

    tds_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0)
    tds_section = models.CharField(max_length=10, blank=True, null=True)
    tds_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)

    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.description} ({self.invoice.invoice_no})"


class JournalEntry(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='journal_entries')
    date = models.DateField()
    description = models.CharField(max_length=255)
    reference_no = models.CharField(max_length=100, blank=True, null=True)
    invoice = models.OneToOneField(
        SalesInvoice, on_delete=models.SET_NULL, null=True, blank=True, related_name='journal_entry')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"JE-{self.pk} on {self.date}"


class JournalItem(models.Model):
    entry = models.ForeignKey(
        JournalEntry, on_delete=models.CASCADE, related_name='items')
    account = models.ForeignKey(LedgerAccount, on_delete=models.PROTECT)
    debit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    credit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    narration = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"{self.account.name} | DR: {self.debit} | CR: {self.credit}"


class PurchaseInvoice(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='purchase_invoices')
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('SENT', 'Sent'),
        ('PART_PAID', 'Partially Paid'),
        ('PAID', 'Paid'),
        ('OVERDUE', 'Overdue'),
    ]

    invoice_no = models.CharField(max_length=50)
    invoice_date = models.DateField()
    supplier = models.ForeignKey(
        Party, on_delete=models.PROTECT, related_name='purchase_invoices')

    # Auto-filled from supplier for snapshot consistency
    gstin = models.CharField(max_length=15, blank=True, null=True)
    pan_no = models.CharField(max_length=10, blank=True, null=True)
    state = models.CharField(max_length=2, choices=INDIAN_STATES)
    place_of_supply = models.CharField(max_length=2, choices=INDIAN_STATES)
    is_igst = models.BooleanField(default=False)

    rcm_applicable = models.BooleanField(default=False)
    itc_eligible = models.BooleanField(default=True)

    expense_ledger = models.ForeignKey(
        LedgerAccount, on_delete=models.PROTECT, related_name='expense_invoices', null=True, blank=True)
    stock_ledger = models.ForeignKey(
        LedgerAccount, on_delete=models.PROTECT, related_name='stock_invoices', null=True, blank=True)

    due_date = models.DateField(blank=True, null=True)
    payment_terms = models.TextField(blank=True, null=True)
    narration = models.TextField(blank=True, null=True)
    reference_no = models.CharField(max_length=100, blank=True, null=True)

    # Totals
    total_taxable = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    total_cgst = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    total_sgst = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    total_igst = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    total_tds = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    amount_paid = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)

    original_invoice_file = models.FileField(
        upload_to='purchase_invoices/', blank=True, null=True)
    ocr_extracted = models.BooleanField(default=False)

    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default='DRAFT')
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('supplier', 'invoice_no', 'invoice_date')

    def __str__(self):
        return f"{self.invoice_no} ({self.supplier.name})"


class PurchaseInvoiceItem(models.Model):
    invoice = models.ForeignKey(
        PurchaseInvoice, on_delete=models.CASCADE, related_name='items')
    description = models.CharField(max_length=255)
    hsn_sac = models.CharField(max_length=10, blank=True, null=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    taxable_amount = models.DecimalField(max_digits=12, decimal_places=2)

    gst_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0)
    cgst_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    sgst_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    igst_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)

    tds_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0)
    tds_section = models.CharField(max_length=10, blank=True, null=True)
    tds_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)

    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.description} ({self.invoice.invoice_no})"


class PaymentEntry(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='payment_entries')
    TYPE_CHOICES = [
        ('AGAINST_INVOICE', 'Against Invoice'),
        ('ADVANCE', 'Advance'),
        ('ON_ACCOUNT', 'On Account'),
        ('SETTLEMENT', 'Settlement'),
    ]
    MODE_CHOICES = [
        ('CASH', 'Cash'),
        ('BANK', 'Bank Transfer'),
        ('UPI', 'UPI'),
        ('CHEQUE', 'Cheque'),
        ('NEFT', 'NEFT'),
        ('RTGS', 'RTGS'),
    ]

    payment_no = models.CharField(max_length=50, unique=True)
    payment_date = models.DateField()
    party = models.ForeignKey(
        Party, on_delete=models.PROTECT, related_name='payments')
    payment_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    payment_mode = models.CharField(max_length=20, choices=MODE_CHOICES)

    # Only for Bank modes
    bank_account = models.ForeignKey(LedgerAccount, on_delete=models.PROTECT, limit_choices_to={
                                     'account_type': 'ASSET'}, null=True, blank=True)
    cheque_no = models.CharField(max_length=50, blank=True, null=True)
    utr_no = models.CharField(max_length=100, blank=True, null=True)

    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    narration = models.TextField(blank=True, null=True)

    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.payment_no} - {self.party.name}"


class PaymentAllocation(models.Model):
    payment = models.ForeignKey(
        PaymentEntry, on_delete=models.CASCADE, related_name='allocations')
    invoice_type = models.CharField(
        max_length=10, choices=[('SALES', 'Sales'), ('PURCHASE', 'Purchase')])
    sales_invoice = models.ForeignKey(
        SalesInvoice, on_delete=models.SET_NULL, null=True, blank=True)
    purchase_invoice = models.ForeignKey(
        PurchaseInvoice, on_delete=models.SET_NULL, null=True, blank=True)
    allocated_amount = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"Alloc to {self.sales_invoice or self.purchase_invoice} : {self.allocated_amount}"
