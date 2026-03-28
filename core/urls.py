from django.urls import path
from django.contrib.auth import views as auth_views
from .views import (
    DashboardView, PartyListView,
    PartyCreateView, PartyUpdateView, PartyDeleteView, PartyDetailView,
    InvoiceListView, InvoiceCreateView, InvoiceUpdateView, InvoicePDFView, InvoiceDeleteView,
    PurchaseListView, PurchaseCreateView, PurchaseUpdateView, OCRUploadView,
    PaymentListView, PaymentCreateView, PaymentPDFView,
    ReportIndexView, PartyLedgerView, OutstandingView, AgeingReportView, GSTReportView,
    CashBankBookView, TDSReportView, UserSettingsView,
    SignUpView, UserCreateView, UserUpdateView, UserToggleActiveView
)

urlpatterns = [
    # Auth URLs
    path('login/', auth_views.LoginView.as_view(template_name='registration/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('signup/', SignUpView.as_view(), name='signup'),

    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('parties/', PartyListView.as_view(), name='party-list'),
    path('parties/add/', PartyCreateView.as_view(), name='party-add'),
    path('parties/<int:pk>/', PartyDetailView.as_view(), name='party-detail'),
    path('parties/<int:pk>/edit/', PartyUpdateView.as_view(), name='party-edit'),
    path('parties/<int:pk>/delete/',
         PartyDeleteView.as_view(), name='party-delete'),

    path('invoices/', InvoiceListView.as_view(), name='invoice-list'),
    path('invoices/add/', InvoiceCreateView.as_view(), name='invoice-create'),
    path('invoices/<int:pk>/edit/',
         InvoiceUpdateView.as_view(), name='invoice-edit'),
    path('invoices/<int:pk>/pdf/', InvoicePDFView.as_view(), name='invoice-pdf'),
    path('invoices/<int:pk>/delete/',
         InvoiceDeleteView.as_view(), name='invoice-delete'),

    path('purchases/', PurchaseListView.as_view(), name='purchase-list'),
    path('purchases/add/', PurchaseCreateView.as_view(), name='purchase-create'),
    path('purchases/ocr/', OCRUploadView.as_view(), name='ocr-upload'),
    path('purchases/<int:pk>/edit/',
         PurchaseUpdateView.as_view(), name='purchase-update'),
    # Force reload of URLs

    path('payments/', PaymentListView.as_view(), name='payment-list'),
    path('payments/add/', PaymentCreateView.as_view(), name='payment-create'),
    path('payments/<int:pk>/pdf/', PaymentPDFView.as_view(), name='payment-pdf'),

    path('reports/', ReportIndexView.as_view(), name='report-index'),
    path('reports/party-ledger/', PartyLedgerView.as_view(),
         name='report-party-ledger'),
    path('reports/outstanding/', OutstandingView.as_view(),
         name='report-outstanding'),
    path('reports/ageing/', AgeingReportView.as_view(), name='report-ageing'),
    path('reports/gst/', GSTReportView.as_view(), name='report-gst'),
    path('reports/cash-bank/', CashBankBookView.as_view(), name='report-cash-bank'),
    path('reports/tds/', TDSReportView.as_view(), name='report-tds'),

    path('settings/users/', UserSettingsView.as_view(), name='user-settings'),
    path('settings/users/add/', UserCreateView.as_view(), name='user-create'),
    path('settings/users/<int:pk>/edit/',
         UserUpdateView.as_view(), name='user-edit'),
    path('settings/users/<int:pk>/toggle/',
         UserToggleActiveView.as_view(), name='user-toggle'),

    path('', DashboardView.as_view(), name='index'),
]
