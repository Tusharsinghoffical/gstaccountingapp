from django.contrib import admin
from .models import (
    CompanyProfile, UserProfile, Party, LedgerAccount, 
    SalesInvoice, SalesInvoiceItem, 
    PurchaseInvoice, PurchaseInvoiceItem, 
    PaymentEntry, JournalEntry, JournalItem
)

class SalesInvoiceItemInline(admin.TabularInline):
    model = SalesInvoiceItem
    extra = 0

@admin.register(SalesInvoice)
class SalesInvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_no', 'party', 'invoice_date', 'net_amount', 'status')
    list_filter = ('status', 'invoice_date')
    search_fields = ('invoice_no', 'party__name')
    inlines = [SalesInvoiceItemInline]

class PurchaseInvoiceItemInline(admin.TabularInline):
    model = PurchaseInvoiceItem
    extra = 0

@admin.register(PurchaseInvoice)
class PurchaseInvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_no', 'supplier', 'invoice_date', 'net_amount', 'status')
    list_filter = ('status', 'invoice_date')
    search_fields = ('invoice_no', 'supplier__name')
    inlines = [PurchaseInvoiceItemInline]

class JournalItemInline(admin.TabularInline):
    model = JournalItem
    extra = 0

@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ('id', 'date', 'description', 'reference_no')
    search_fields = ('description', 'reference_no')
    inlines = [JournalItemInline]

admin.site.register(CompanyProfile)
admin.site.register(UserProfile)
admin.site.register(Party)
admin.site.register(LedgerAccount)
admin.site.register(PaymentEntry)
