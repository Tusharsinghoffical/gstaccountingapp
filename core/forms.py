from django import forms
from .models import (
    CompanyProfile, INDIAN_STATES, Party, LedgerAccount, 
    SalesInvoice, SalesInvoiceItem, PurchaseInvoice, PurchaseInvoiceItem,
    PaymentEntry, PaymentAllocation
)
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.forms import inlineformset_factory
from .utils import get_fiscal_year, get_fy_range

class CompanySetupForm(forms.ModelForm):
    admin_username = forms.CharField(max_length=150, help_text="Superuser username")
    admin_email = forms.EmailField(help_text="Superuser email")
    admin_password = forms.CharField(widget=forms.PasswordInput, min_length=8)
    confirm_password = forms.CharField(widget=forms.PasswordInput)

    class Meta:
        model = CompanyProfile
        fields = [
            'company_name', 'establishment_date', 'cin_no', 'gst_no', 'pan_no',
            'address', 'state', 'pin_code', 'phone_no', 'email', 'logo'
        ]
        widgets = {
            'establishment_date': forms.DateInput(attrs={'type': 'date'}),
            'address': forms.Textarea(attrs={'rows': 3}),
        }

    def clean_admin_password(self):
        password = self.cleaned_data.get('admin_password')
        if not any(char.isdigit() for char in password):
            raise ValidationError('Password must contain at least one number.')
        if not any(char.isalpha() for char in password):
            raise ValidationError('Password must contain at least one letter.')
        return password

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get("admin_password")
        confirm_password = cleaned_data.get("confirm_password")
        if password and confirm_password and password != confirm_password:
            self.add_error('confirm_password', "Passwords do not match")
        return cleaned_data

    def save_all(self):
        profile = self.save()
        username = self.cleaned_data.get('admin_username')
        user, created = User.objects.get_or_create(username=username)
        user.email = self.cleaned_data.get('admin_email')
        user.set_password(self.cleaned_data.get('admin_password'))
        user.is_superuser = True
        user.is_staff = True
        user.save()
        
        # Ensure the admin has the ADMIN role
        if hasattr(user, 'profile'):
            user.profile.role = 'ADMIN'
            user.profile.save()
            
        return profile

class PartyForm(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['party_type'].empty_label = None

    class Meta:
        model = Party
        fields = [
            'name', 'gstin', 'pan_no', 'party_type', 'address', 'city', 
            'state', 'pin_code', 'phone', 'email', 'opening_balance', 'balance_type'
        ]
        widgets = {
            'address': forms.Textarea(attrs={'rows': 2}),
        }

class SalesInvoiceForm(forms.ModelForm):
    class Meta:
        model = SalesInvoice
        fields = [
            'invoice_no', 'invoice_date', 'party', 'place_of_supply', 'due_date',
            'payment_terms', 'narration', 'reference_no', 'status',
            'total_taxable', 'total_cgst', 'total_sgst', 'total_igst', 'total_tds', 'net_amount'
        ]

        widgets = {
            'party': forms.Select(attrs={'class': 'select2'}),
            'invoice_date': forms.DateInput(attrs={'type': 'date'}),
            'due_date': forms.DateInput(attrs={'type': 'date'}),
        }

    def __init__(self, *args, **kwargs):
        kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        self.fields['party'].queryset = Party.objects.filter(
            Q(party_type='CUSTOMER') | Q(party_type='BOTH'),
            is_deleted=False
        )
        self.fields['party'].empty_label = "Select a customer"

    def clean_invoice_date(self):
        invoice_date = self.cleaned_data.get('invoice_date')
        if invoice_date:
            fy = get_fiscal_year()
            start_date, end_date = get_fy_range(fy)
            if invoice_date < start_date or invoice_date > end_date:
                raise ValidationError(f"Invoice date must be within the current financial year ({fy}).")
        return invoice_date

SalesInvoiceItemFormSet = inlineformset_factory(
    SalesInvoice, SalesInvoiceItem,
    fields=[
        'description', 'hsn_sac', 'quantity', 'rate', 'taxable_amount',
        'gst_percent', 'cgst_amount', 'sgst_amount', 'igst_amount',
        'tds_percent', 'tds_section', 'tds_amount', 'line_total'
    ],
    extra=1,
    can_delete=True
)

class PurchaseInvoiceForm(forms.ModelForm):
    class Meta:
        model = PurchaseInvoice
        fields = [
            'invoice_no', 'invoice_date', 'supplier', 'place_of_supply', 'due_date',
            'payment_terms', 'narration', 'reference_no', 'status', 
            'rcm_applicable', 'itc_eligible', 'expense_ledger', 'stock_ledger', 'original_invoice_file',
            'total_taxable', 'total_cgst', 'total_sgst', 'total_igst', 'total_tds', 'net_amount'
        ]

        widgets = {
            'supplier': forms.Select(attrs={'class': 'select2'}),
            'invoice_date': forms.DateInput(attrs={'type': 'date'}),
            'due_date': forms.DateInput(attrs={'type': 'date'}),
            'expense_ledger': forms.Select(attrs={'class': 'select2-simple'}),
            'stock_ledger': forms.Select(attrs={'class': 'select2-simple'}),
        }

    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        self.fields['supplier'].queryset = Party.objects.filter(
            Q(party_type='SUPPLIER') | Q(party_type='BOTH'),
            is_deleted=False
        )
        self.fields['expense_ledger'].queryset = LedgerAccount.objects.filter(account_type='EXPENSE', is_deleted=False)
        self.fields['stock_ledger'].queryset = LedgerAccount.objects.filter(account_type='ASSET', is_deleted=False)

    def clean_invoice_date(self):
        invoice_date = self.cleaned_data.get('invoice_date')
        if invoice_date:
            fy = get_fiscal_year()
            start_date, end_date = get_fy_range(fy)
            if invoice_date < start_date or invoice_date > end_date:
                raise ValidationError(f"Invoice date must be within the current financial year ({fy}).")
        return invoice_date

PurchaseInvoiceItemFormSet = inlineformset_factory(
    PurchaseInvoice, PurchaseInvoiceItem,
    fields=[
        'description', 'hsn_sac', 'quantity', 'rate', 'taxable_amount',
        'gst_percent', 'cgst_amount', 'sgst_amount', 'igst_amount',
        'tds_percent', 'tds_section', 'tds_amount', 'line_total'
    ],
    extra=1,
    can_delete=True
)

class PaymentEntryForm(forms.ModelForm):
    class Meta:
        model = PaymentEntry
        fields = [
            'payment_no', 'payment_date', 'party', 'payment_type', 
            'payment_mode', 'bank_account', 'cheque_no', 'utr_no', 
            'total_amount', 'narration'
        ]
        widgets = {
            'payment_date': forms.DateInput(attrs={'type': 'date'}),
            'party': forms.Select(attrs={'class': 'select2'}),
            'bank_account': forms.Select(attrs={'class': 'select2-simple'}),
        }

    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        self.fields['party'].queryset = Party.objects.filter(is_deleted=False)
        self.fields['bank_account'].queryset = LedgerAccount.objects.filter(
            Q(account_type='ASSET') &
            (Q(name__icontains='Bank') | Q(name__icontains='Cash') | Q(account_code__startswith='BANK') | Q(account_code__startswith='CASH'))
        )

    def clean_payment_date(self):
        payment_date = self.cleaned_data.get('payment_date')
        if payment_date:
            fy = get_fiscal_year()
            start_date, end_date = get_fy_range(fy)
            if payment_date < start_date or payment_date > end_date:
                raise ValidationError(f"Payment date must be within the current financial year ({fy}).")
        return payment_date
