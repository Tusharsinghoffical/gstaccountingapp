from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic import View, ListView, CreateView, UpdateView, DetailView, FormView, TemplateView
from django.contrib.auth import views as auth_views
from django.contrib.auth.mixins import LoginRequiredMixin
from .forms import (
    PartyForm, SalesInvoiceForm, SalesInvoiceItemFormSet,
    PurchaseInvoiceForm, PurchaseInvoiceItemFormSet, PaymentEntryForm
)
from .models import (
    CompanyProfile, Party, SalesInvoice, SalesInvoiceItem,
    PurchaseInvoice, PurchaseInvoiceItem, PaymentEntry, PaymentAllocation
)
from .services import (
    create_invoice_journal_entry, create_purchase_journal_entry,
    create_payment_journal_entry, update_invoice_payment_status
)
from .excel_export import ExcelExporter
from .models import JournalItem, JournalEntry, SalesInvoice, PurchaseInvoice, PaymentEntry, Party, LedgerAccount, UserProfile
from .mixins import AuditorReadOnlyMixin, AdminRequiredMixin
from django.db.models import Sum, Q, F, Count
from django.db.models.functions import TruncMonth
from datetime import date, timedelta
from .utils import get_fiscal_year, generate_invoice_no
from .ocr_service import OCRInvoiceService
from django.contrib.auth import login
from django.contrib.auth.models import User
from django.db.models import Q, Sum
from django.urls import reverse_lazy
from django.http import HttpResponse, Http404, JsonResponse
from django.template.loader import render_to_string
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.db import transaction
import tempfile
import os

from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import get_user_model
from django.shortcuts import redirect


def home_redirect_view(request):
    """
    Redirect unauthenticated users to login,
    authenticated users to dashboard.
    """
    if request.user.is_authenticated:
        return redirect('dashboard')
    else:
        return redirect('login')


class CustomLoginView(auth_views.LoginView):
    """
    Custom login view that redirects already logged-in users to dashboard.
    New users are shown the login form.
    """
    template_name = 'registration/login.html'

    def dispatch(self, request, *args, **kwargs):
        # If user is already authenticated, redirect to dashboard
        if request.user.is_authenticated:
            return redirect('index')
        return super().dispatch(request, *args, **kwargs)


class SignUpView(CreateView):
    form_class = UserCreationForm
    success_url = reverse_lazy('login')
    template_name = 'registration/signup.html'

    def dispatch(self, request, *args, **kwargs):
        # If user is already authenticated, redirect to dashboard
        if request.user.is_authenticated:
            return redirect('index')
        return super().dispatch(request, *args, **kwargs)

    def form_valid(self, form):
        user = form.save()
        # Optionally log the user in here, or redirect to login. We redirect to login per success_url.
        return super().form_valid(form)


class PartyListView(ListView):
    model = Party
    template_name = 'parties/list.html'
    context_object_name = 'parties'

    def get_queryset(self):
        queryset = Party.objects.filter(
            is_deleted=False).order_by('-created_at')
        q = self.request.GET.get('q')
        party_type = self.request.GET.get('type')

        if q:
            queryset = queryset.filter(Q(name__icontains=q) | Q(
                gstin__icontains=q) | Q(city__icontains=q))

        if party_type and party_type != 'ALL':
            if party_type == 'CUSTOMER':
                queryset = queryset.filter(
                    Q(party_type='CUSTOMER') | Q(party_type='BOTH'))
            elif party_type == 'SUPPLIER':
                queryset = queryset.filter(
                    Q(party_type='SUPPLIER') | Q(party_type='BOTH'))
            else:
                queryset = queryset.filter(party_type=party_type)
        return queryset

    def get_template_names(self):
        if self.request.headers.get('HX-Request'):
            return ['parties/_table_rows.html']
        return ['parties/list.html']


class PartyCreateView(AuditorReadOnlyMixin, CreateView):
    model = Party
    form_class = PartyForm
    template_name = 'parties/form.html'
    success_url = reverse_lazy('party-list')

    def form_valid(self, form):
        form.instance.user = self.request.user
        return super().form_valid(form)


class PartyUpdateView(AuditorReadOnlyMixin, UpdateView):
    model = Party
    form_class = PartyForm
    template_name = 'parties/form.html'
    success_url = reverse_lazy('party-list')

    def get_queryset(self):
        return Party.objects.filter(is_deleted=False)


class PartyDeleteView(AuditorReadOnlyMixin, View):
    def post(self, request, pk):
        party = get_object_or_404(Party, pk=pk)
        party.is_deleted = True
        party.save()
        return HttpResponse(status=204)


class PartyDetailView(DetailView):
    model = Party
    template_name = 'parties/detail.html'
    context_object_name = 'party'

    def get_queryset(self):
        return Party.objects.all()


class InvoiceListView(ListView):
    model = SalesInvoice
    template_name = 'invoices/sales_list.html'
    context_object_name = 'invoices'

    def get_queryset(self):
        queryset = SalesInvoice.objects.filter(
            is_deleted=False).order_by('-invoice_date', '-invoice_no')
        q = self.request.GET.get('q')
        status = self.request.GET.get('status')
        if q:
            queryset = queryset.filter(
                Q(invoice_no__icontains=q) | Q(party__name__icontains=q))
        if status:
            queryset = queryset.filter(status=status)
        return queryset


class InvoiceCreateView(AuditorReadOnlyMixin, CreateView):
    model = SalesInvoice
    form_class = SalesInvoiceForm
    template_name = 'invoices/sales_form.html'
    success_url = reverse_lazy('invoice-list')

    def get_context_data(self, **kwargs):
        data = super().get_context_data(**kwargs)
        if self.request.POST:
            data['items'] = SalesInvoiceItemFormSet(self.request.POST)
        else:
            data['items'] = SalesInvoiceItemFormSet()
            fy = get_fiscal_year()
            data['form'].fields['invoice_no'].initial = generate_invoice_no(
                SalesInvoice, fy)
        return data

    def form_valid(self, form):
        self.object = None
        context = self.get_context_data()
        items = context['items']

        if items.is_valid():
            with transaction.atomic():
                form.instance.user = self.request.user
                self.object = form.save()
                items.instance = self.object
                items.save()
                create_invoice_journal_entry(self.object)
            return super().form_valid(form)
        else:
            return self.form_invalid(form)


class InvoiceDeleteView(AuditorReadOnlyMixin, View):
    def post(self, request, pk):
        invoice = get_object_or_404(SalesInvoice, pk=pk)
        invoice.is_deleted = True
        invoice.save()

        # Reverse the journal entry
        JournalEntry.objects.filter(invoice=invoice).delete()

        return HttpResponse(status=204)


class InvoiceUpdateView(AuditorReadOnlyMixin, UpdateView):
    model = SalesInvoice
    form_class = SalesInvoiceForm
    template_name = 'invoices/sales_form.html'
    success_url = reverse_lazy('invoice-list')

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def get_queryset(self):
        return SalesInvoice.objects.all()

    def get_context_data(self, **kwargs):
        data = super().get_context_data(**kwargs)
        if self.request.POST:
            data['items'] = SalesInvoiceItemFormSet(
                self.request.POST, instance=self.object)
        else:
            data['items'] = SalesInvoiceItemFormSet(instance=self.object)
        return data

    def form_valid(self, form):
        context = self.get_context_data()
        items = context['items']

        if items.is_valid():
            with transaction.atomic():
                form.instance.user = self.request.user
                self.object = form.save()
                items.instance = self.object
                items.save()
                create_invoice_journal_entry(self.object)
            return super().form_valid(form)
        else:
            return self.form_invalid(form)


class InvoicePDFView(View):
    def get(self, request, pk):
        invoice = get_object_or_404(SalesInvoice, pk=pk)
        company = CompanyProfile.objects.first()
        from num2words import num2words
        amount_in_words = ""
        try:
            amount_in_words = num2words(
                invoice.net_amount, lang='en_IN', to='currency').upper()
        except:
            amount_in_words = num2words(invoice.net_amount).upper()

        html_string = render_to_string('invoices/pdf_template.html', {
            'invoice': invoice,
            'company': company,
            'amount_in_words': amount_in_words,
            'request': request,
        })

        return HttpResponse(html_string)


class PurchaseListView(ListView):
    model = PurchaseInvoice
    template_name = 'invoices/purchase_list.html'
    context_object_name = 'invoices'

    def get_queryset(self):
        return PurchaseInvoice.objects.filter(is_deleted=False).order_by('-invoice_date')


class PurchaseCreateView(AuditorReadOnlyMixin, CreateView):
    model = PurchaseInvoice
    form_class = PurchaseInvoiceForm
    template_name = 'invoices/purchase_form.html'
    success_url = reverse_lazy('purchase-list')

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def get_context_data(self, **kwargs):
        from .forms import PurchaseInvoiceItemFormSet
        data = super().get_context_data(**kwargs)
        if self.request.POST:
            data['items'] = PurchaseInvoiceItemFormSet(
                self.request.POST, self.request.FILES)
        else:
            data['items'] = PurchaseInvoiceItemFormSet()
        return data

    def form_valid(self, form):
        context = self.get_context_data()
        items = context['items']
        form.instance.user = self.request.user
        with transaction.atomic():
            self.object = form.save()
            if items.is_valid():
                items.instance = self.object
                items.save()
                # Assuming this global function exists based on Sales code
                try:
                    from .services import create_purchase_journal_entry
                    create_purchase_journal_entry(self.object)
                except ImportError:
                    pass
            else:
                return self.form_invalid(form)
        return super().form_valid(form)


class PurchaseUpdateView(AuditorReadOnlyMixin, UpdateView):
    model = PurchaseInvoice
    form_class = PurchaseInvoiceForm
    template_name = 'invoices/purchase_form.html'
    success_url = reverse_lazy('purchase-list')

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def get_queryset(self):
        return PurchaseInvoice.objects.filter(is_deleted=False)

    def get_context_data(self, **kwargs):
        data = super().get_context_data(**kwargs)
        if self.request.POST:
            data['items'] = PurchaseInvoiceItemFormSet(
                self.request.POST, self.request.FILES, instance=self.object)
        else:
            data['items'] = PurchaseInvoiceItemFormSet(instance=self.object)
        return data

    def form_valid(self, form):
        context = self.get_context_data()
        items = context['items']

        if items.is_valid():
            with transaction.atomic():
                self.object = form.save()
                items.instance = self.object
                items.save()
                try:
                    from .services import create_purchase_journal_entry
                    create_purchase_journal_entry(self.object)
                except ImportError:
                    pass
            return super().form_valid(form)
        else:
            return self.form_invalid(form)


@method_decorator(csrf_exempt, name='dispatch')
class OCRUploadView(AuditorReadOnlyMixin, View):
    def get(self, request):
        # Return 405 Method Not Allowed with helpful message
        return JsonResponse({
            'error': 'Method not allowed',
            'message': 'OCR upload endpoint only accepts POST requests with file uploads'
        }, status=405)
    
    def post(self, request):
        if 'file' not in request.FILES:
            return JsonResponse({'error': 'No file uploaded'}, status=400)

        uploaded_file = request.FILES['file']
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(uploaded_file.name)[1]) as tmp:
            for chunk in uploaded_file.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        try:
            text = OCRInvoiceService.extract_text(tmp_path)
            data = OCRInvoiceService.parse_data(text)
            if data['gstin']:
                supplier = Party.objects.filter(
                    gstin=data['gstin'], is_deleted=False).first()
                if supplier:
                    data['supplier_id'] = supplier.id
                    data['supplier_name'] = supplier.name
            return render(request, 'invoices/_ocr_result.html', {'data': data})
        except Exception as e:
            return JsonResponse({'error': f'OCR Failed: {str(e)}'}, status=500)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)


class PaymentListView(ListView):
    model = PaymentEntry
    template_name = 'payments/list.html'
    context_object_name = 'payments'

    def get_queryset(self):
        return PaymentEntry.objects.filter(is_deleted=False).order_by('-payment_date', '-created_at')


class PaymentCreateView(AuditorReadOnlyMixin, CreateView):
    model = PaymentEntry
    form_class = PaymentEntryForm
    template_name = 'payments/form.html'
    success_url = reverse_lazy('payment-list')

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def get_context_data(self, **kwargs):
        data = super().get_context_data(**kwargs)
        party_id = self.request.GET.get('party_id')
        if party_id:
            party = Party.objects.filter(pk=party_id).first()
            if party:
                if party.party_type in ('CUSTOMER', 'BOTH'):
                    data['open_sales'] = SalesInvoice.objects.filter(
                        party=party,
                        status__in=['DRAFT', 'SENT', 'PART_PAID', 'OVERDUE'],
                        is_deleted=False
                    )
                if party.party_type in ('SUPPLIER', 'BOTH'):
                    data['open_purchases'] = PurchaseInvoice.objects.filter(
                        supplier=party,
                        status__in=['DRAFT', 'PART_PAID', 'OVERDUE'],
                        is_deleted=False
                    )
        from django.utils import timezone
        data['now'] = timezone.now()
        return data

    def post(self, request, *args, **kwargs):
        self.object = None
        form = self.get_form()
        if form.is_valid():
            form.instance.user = self.request.user
            with transaction.atomic():
                payment = form.save()

                # Handle allocations from POST data
                # allocations format: items[idx][invoice_id], items[idx][amount], items[idx][type]
                alloc_data = request.POST.getlist('alloc_invoice_id')
                alloc_amounts = request.POST.getlist('alloc_amount')
                alloc_types = request.POST.getlist('alloc_type')

                for i in range(len(alloc_data)):
                    if float(alloc_amounts[i]) > 0:
                        alloc = PaymentAllocation.objects.create(
                            payment=payment,
                            invoice_type=alloc_types[i],
                            allocated_amount=alloc_amounts[i]
                        )
                        if alloc_types[i] == 'SALES':
                            alloc.sales_invoice_id = alloc_data[i]
                            alloc.save()
                            update_invoice_payment_status(
                                'SALES', alloc_data[i])
                        else:
                            alloc.purchase_invoice_id = alloc_data[i]
                            alloc.save()
                            update_invoice_payment_status(
                                'PURCHASE', alloc_data[i])

                create_payment_journal_entry(payment)
                return redirect(self.success_url)
        return self.form_invalid(form)


class PaymentPDFView(View):
    def get(self, request, pk):
        payment = get_object_or_404(PaymentEntry, pk=pk)
        company = CompanyProfile.objects.filter(user=request.user).first()

        html_string = render_to_string('payments/voucher_pdf.html', {
            'payment': payment,
            'company': company,
        })

        return HttpResponse(html_string)


class ReportIndexView(TemplateView):
    template_name = 'reports/index.html'


class DashboardView(LoginRequiredMixin, TemplateView):
    template_name = 'dashboard/index.html'
    login_url = 'login'  # Redirect unauthenticated users to login page

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        today = date.today()
        first_day_current = today.replace(day=1)
        last_day_prev = first_day_current - timedelta(days=1)
        first_day_prev = last_day_prev.replace(day=1)

        # KPIs
        sales_curr = SalesInvoice.objects.filter(invoice_date__range=[
                                                 first_day_current, today], is_deleted=False).aggregate(total=Sum('net_amount'))['total'] or 0
        sales_prev = SalesInvoice.objects.filter(invoice_date__range=[
                                                 first_day_prev, last_day_prev], is_deleted=False).aggregate(total=Sum('net_amount'))['total'] or 0

        purchase_curr = PurchaseInvoice.objects.filter(invoice_date__range=[
                                                       first_day_current, today], is_deleted=False).aggregate(total=Sum('net_amount'))['total'] or 0

        # Outstanding
        recv = SalesInvoice.objects.filter(status__in=['SENT', 'PART_PAID', 'OVERDUE'], is_deleted=False).aggregate(
            t=Sum(F('net_amount') - F('amount_received')))['t'] or 0
        paybl = PurchaseInvoice.objects.filter(status__in=['DRAFT', 'PART_PAID', 'OVERDUE'], is_deleted=False).aggregate(
            t=Sum(F('net_amount') - F('amount_paid')))['t'] or 0

        # Cash & Bank
        cash_acc = LedgerAccount.objects.filter(name__icontains='Cash').first()
        bank_acc = LedgerAccount.objects.filter(name__icontains='Bank').first()

        def get_bal(acc):
            if not acc:
                return 0
            items = JournalItem.objects.filter(account=acc).aggregate(
                dr=Sum('debit'), cr=Sum('credit'))
            return (acc.opening_balance if acc.balance_type == 'DR' else -acc.opening_balance) + ((items['dr'] or 0) - (items['cr'] or 0))

        context.update({
            'sales_curr': sales_curr,
            'sales_prev_pct': ((sales_curr - sales_prev) / sales_prev * 100) if sales_prev > 0 else 100,
            'purchase_curr': purchase_curr,
            'receivable': recv,
            'payable': paybl,
            'cash_bal': get_bal(cash_acc),
            'bank_bal': get_bal(bank_acc),
            'recent_sales': SalesInvoice.objects.filter(is_deleted=False).order_by('-created_at')[:10],
            'recent_purchases': PurchaseInvoice.objects.filter(is_deleted=False).order_by('-created_at')[:10],
            'overdue_count': SalesInvoice.objects.filter(status='OVERDUE', is_deleted=False).count(),
            'invoices_today': SalesInvoice.objects.filter(created_at__date=today, is_deleted=False).count(),
            'total_parties': Party.objects.filter(is_deleted=False).count(),
        })

        # Chart Data (Last 6 Months)
        months = []
        sales_data = []
        purchase_data = []
        for i in range(5, -1, -1):
            m_date = today - timedelta(days=i*30)
            m_start = m_date.replace(day=1)
            months.append(m_start.strftime('%b %Y'))
            s = SalesInvoice.objects.filter(invoice_date__month=m_start.month, invoice_date__year=m_start.year,
                                            is_deleted=False).aggregate(t=Sum('net_amount'))['t'] or 0
            p = PurchaseInvoice.objects.filter(
                invoice_date__month=m_start.month, invoice_date__year=m_start.year, is_deleted=False).aggregate(t=Sum('net_amount'))['t'] or 0
            sales_data.append(float(s))
            purchase_data.append(float(p))

        context['chart_months'] = months
        context['chart_sales'] = sales_data
        context['chart_purchases'] = purchase_data

        # Donut Chart - Status Breakdown
        status_counts = SalesInvoice.objects.filter(
            is_deleted=False).values('status').annotate(count=Count('id'))
        context['status_labels'] = [s['status'] for s in status_counts]
        context['status_data'] = [s['count'] for s in status_counts]

        return context


class UserSettingsView(AdminRequiredMixin, ListView):
    template_name = 'settings/users.html'
    context_object_name = 'users'

    def get_queryset(self):
        from django.contrib.auth.models import User
        return User.objects.all().select_related('profile').order_by('-is_active', 'username')


class UserCreateView(AdminRequiredMixin, View):
    def post(self, request):
        from django.contrib.auth.models import User
        from django.contrib import messages
        username = request.POST.get('username', '').strip()
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '').strip()
        role = request.POST.get('role', 'ACCOUNTANT')

        if not username or not password:
            messages.error(request, 'Username and password are required.')
            return redirect('user-settings')
        if User.objects.filter(username=username).exists():
            messages.error(request, f'Username "{username}" already exists.')
            return redirect('user-settings')

        user = User.objects.create_user(
            username=username, email=email, password=password)
        user.profile.role = role
        user.profile.save()
        messages.success(request, f'User "{username}" created successfully.')
        return redirect('user-settings')


class UserUpdateView(AdminRequiredMixin, View):
    def post(self, request, pk):
        from django.contrib.auth.models import User
        from django.contrib import messages
        target = get_object_or_404(User, pk=pk)
        # Prevent editing self into non-admin
        role = request.POST.get('role', target.profile.role)
        email = request.POST.get('email', target.email).strip()
        new_password = request.POST.get('password', '').strip()

        target.email = email
        target.save()
        target.profile.role = role
        target.profile.save()
        if new_password:
            target.set_password(new_password)
            target.save()
        messages.success(request, f'User "{target.username}" updated.')
        return redirect('user-settings')


class UserToggleActiveView(AdminRequiredMixin, View):
    def post(self, request, pk):
        from django.contrib.auth.models import User
        from django.contrib import messages
        target = get_object_or_404(User, pk=pk)
        if target == request.user:
            messages.error(request, 'You cannot deactivate your own account.')
        else:
            target.is_active = not target.is_active
            target.save()
            status = 'activated' if target.is_active else 'deactivated'
            messages.success(
                request, f'User "{target.username}" has been {status}.')
        return redirect('user-settings')


class PartyLedgerView(ListView):
    template_name = 'reports/party_ledger.html'
    context_object_name = 'ledger_items'

    def get_queryset(self):
        party_id = self.request.GET.get('party')
        if not party_id:
            return []

        from_date = self.request.GET.get('from_date') or '2000-01-01'
        to_date = self.request.GET.get('to_date') or '2100-12-31'

        items = JournalItem.objects.filter(
            entry__date__range=[from_date, to_date],
            account__account_code=f"PRTY-{party_id}"
        ).order_by('entry__date', 'entry__created_at')

        # Calculate running balance
        try:
            party = Party.objects.get(pk=party_id)
        except (Party.DoesNotExist, ValueError):
            return items
        balance = party.opening_balance if party.balance_type == 'DR' else -party.opening_balance

        for item in items:
            balance += (item.debit - item.credit)
            item.running_balance = balance
            item.abs_balance = abs(balance)

        return items

    def render_to_response(self, context, **response_kwargs):
        export_type = self.request.GET.get('export')
        if not export_type:
            return super().render_to_response(context, **response_kwargs)

        items = self.get_queryset()
        try:
            party = Party.objects.get(pk=self.request.GET.get('party'))
        except (Party.DoesNotExist, ValueError):
            return HttpResponse("Invalid Party Selection", status=400)

        company = CompanyProfile.objects.first()
        columns = ['Date', 'Particulars',
                   'Voucher No', 'Debit', 'Credit', 'Balance']
        data = [[i.entry.date, i.entry.description, i.entry.reference_no,
                 i.debit, i.credit, i.running_balance] for i in items]

        if export_type == 'excel':
            exporter = ExcelExporter("Party Ledger", company.company_name, {
                                     "Party": party.name})
            return exporter.export(columns, data)
        elif export_type == 'pdf':
            from .pdf_export import render_to_pdf
            return render_to_pdf('reports/ledger_pdf.html', {'items': items, 'party': party, 'company': company})
        return super().render_to_response(context, **response_kwargs)

    def get_context_data(self, **kwargs):
        data = super().get_context_data(**kwargs)
        data['parties'] = Party.objects.filter(
            user=self.request.user, is_deleted=False)
        return data


class OutstandingView(ListView):
    template_name = 'reports/outstanding.html'
    context_object_name = 'invoices'

    def get_queryset(self):
        inv_type = self.request.GET.get('type', 'SALES')
        party_id = self.request.GET.get('party')

        if inv_type == 'SALES':
            qs = SalesInvoice.objects.filter(user=self.request.user, status__in=[
                                             'SENT', 'PART_PAID', 'OVERDUE'], is_deleted=False)
            if party_id:
                qs = qs.filter(party_id=party_id)
            for inv in qs:
                inv.outstanding = inv.net_amount - inv.amount_received
                inv.days_overdue = (date.today(
                ) - inv.due_date).days if inv.due_date and inv.due_date < date.today() else 0
        else:
            qs = PurchaseInvoice.objects.filter(user=self.request.user, status__in=[
                                                'DRAFT', 'PART_PAID', 'OVERDUE'], is_deleted=False)
            if party_id:
                qs = qs.filter(supplier_id=party_id)
            for inv in qs:
                inv.outstanding = inv.net_amount - inv.amount_paid
                inv.days_overdue = (date.today(
                ) - inv.due_date).days if inv.due_date and inv.due_date < date.today() else 0
        return qs

    def render_to_response(self, context, **response_kwargs):
        export_type = self.request.GET.get('export')
        if not export_type:
            return super().render_to_response(context, **response_kwargs)

        invoices = self.get_queryset()
        company = CompanyProfile.objects.filter(user=self.request.user).first()
        columns = ['Party', 'Invoice No', 'Date', 'Due Date',
                   'Amount', 'Paid', 'Outstanding', 'Days Overdue']
        data = []
        for inv in invoices:
            data.append([
                inv.party.name if hasattr(inv, 'party') else inv.supplier.name,
                inv.invoice_no, inv.invoice_date, inv.due_date, inv.net_amount,
                inv.amount_received if hasattr(
                    inv, 'amount_received') else inv.amount_paid,
                inv.outstanding, inv.days_overdue
            ])

        if export_type == 'excel':
            exporter = ExcelExporter(
                "Outstanding Report", company.company_name)
            return exporter.export(columns, data, highlight_overdue=True)
        return super().render_to_response(context, **response_kwargs)


class AgeingReportView(TemplateView):
    template_name = 'reports/ageing.html'

    def get_context_data(self, **kwargs):
        data = super().get_context_data(**kwargs)
        # Ageing logic: Buckets 0-30, 31-60, 61-90, 91-120, 120+
        # This is group by party
        res = []
        for party in Party.objects.filter(user=self.request.user, is_deleted=False):
            invoices = SalesInvoice.objects.filter(user=self.request.user, party=party, status__in=[
                                                   'SENT', 'PART_PAID', 'OVERDUE'], is_deleted=False)
            buckets = [0, 0, 0, 0, 0]  # 0-30, 31-60, ...
            total = 0
            for inv in invoices:
                out = inv.net_amount - inv.amount_received
                days = (date.today() - inv.invoice_date).days
                if days <= 30:
                    buckets[0] += out
                elif days <= 60:
                    buckets[1] += out
                elif days <= 90:
                    buckets[2] += out
                elif days <= 120:
                    buckets[3] += out
                else:
                    buckets[4] += out
                total += out
            if total > 0:
                res.append(
                    {'party': party, 'buckets': buckets, 'total': total})
        data['ageing_data'] = res
        return data


class GSTReportView(TemplateView):
    template_name = 'reports/gst_report.html'

    def get_context_data(self, **kwargs):
        data = super().get_context_data(**kwargs)
        data['sales'] = SalesInvoice.objects.filter(
            user=self.request.user, is_deleted=False).order_by('-invoice_date')
        data['purchases'] = PurchaseInvoice.objects.filter(
            user=self.request.user, is_deleted=False).order_by('-invoice_date')
        return data

    def render_to_response(self, context, **response_kwargs):
        export_type = self.request.GET.get('export')
        if export_type != 'excel':
            return super().render_to_response(context, **response_kwargs)

        company = CompanyProfile.objects.filter(user=self.request.user).first()
        sales = context['sales']
        columns = ['Invoice No', 'Date', 'Party', 'GSTIN',
                   'Taxable', 'CGST', 'SGST', 'IGST', 'Total']
        data = [[i.invoice_no, i.invoice_date, i.party.name, i.gstin, i.total_taxable,
                 i.total_cgst, i.total_sgst, i.total_igst, i.net_amount] for i in sales]

        exporter = ExcelExporter("GSTR-1 Sales Report", company.company_name)
        return exporter.export(columns, data)


class CashBankBookView(ListView):
    template_name = 'reports/cash_bank.html'
    context_object_name = 'ledger_items'

    def get_queryset(self):
        acc_id = self.request.GET.get('account')
        if not acc_id:
            return []

        from_date = self.request.GET.get('from_date') or '2000-01-01'
        to_date = self.request.GET.get('to_date') or '2100-12-31'

        items = JournalItem.objects.filter(
            entry__date__range=[from_date, to_date],
            account_id=acc_id
        ).order_by('entry__date', 'entry__created_at')

        # Opening Balance logic simplified for this module
        account = LedgerAccount.objects.get(pk=acc_id, user=self.request.user)
        balance = account.opening_balance if account.balance_type == 'DR' else - \
            account.opening_balance

        for item in items:
            balance += (item.debit - item.credit)
            item.running_balance = balance
        return items

    def get_context_data(self, **kwargs):
        data = super().get_context_data(**kwargs)
        data['accounts'] = LedgerAccount.objects.filter(
            Q(user=self.request.user) & Q(account_type='ASSET') &
            (Q(name__icontains='Bank') | Q(name__icontains='Cash') | Q(
                account_code__startswith='BANK') | Q(account_code__startswith='CASH'))
        )
        return data

    def render_to_response(self, context, **response_kwargs):
        export_type = self.request.GET.get('export')
        if not export_type:
            return super().render_to_response(context, **response_kwargs)

        items = self.get_queryset()
        account = LedgerAccount.objects.get(
            pk=self.request.GET.get('account'), user=self.request.user)
        company = CompanyProfile.objects.filter(user=self.request.user).first()
        columns = ['Date', 'Particulars',
                   'Voucher No', 'Debit', 'Credit', 'Balance']
        data = [[i.entry.date, i.entry.description, i.entry.reference_no,
                 i.debit, i.credit, i.running_balance] for i in items]

        if export_type == 'excel':
            exporter = ExcelExporter(
                "Cash/Bank Book", company.company_name, {"Account": account.name})
            return exporter.export(columns, data)
        return super().render_to_response(context, **response_kwargs)


class TDSReportView(ListView):
    template_name = 'reports/tds_report.html'
    context_object_name = 'items'

    def get_queryset(self):
        from .models import SalesInvoiceItem, PurchaseInvoiceItem
        s_items = SalesInvoiceItem.objects.filter(tds_amount__gt=0)
        p_items = PurchaseInvoiceItem.objects.filter(tds_amount__gt=0)
        res = []
        for i in s_items:
            res.append({'party': i.invoice.party, 'date': i.invoice.invoice_date, 'section': i.tds_section,
                       'taxable': i.taxable_amount, 'percent': i.tds_percent, 'amount': i.tds_amount, 'inv_no': i.invoice.invoice_no})
        for i in p_items:
            res.append({'party': i.invoice.supplier, 'date': i.invoice.invoice_date, 'section': i.tds_section,
                       'taxable': i.taxable_amount, 'percent': i.tds_percent, 'amount': i.tds_amount, 'inv_no': i.invoice.invoice_no})
        return res

    def render_to_response(self, context, **response_kwargs):
        if self.request.GET.get('export') != 'excel':
            return super().render_to_response(context, **response_kwargs)
        items = self.get_queryset()
        company = CompanyProfile.objects.first()
        columns = ['Date', 'Party', 'Section', 'Taxable',
                   'TDS %', 'TDS Amount', 'Invoice No']
        data = [[i['date'], i['party'].name, i['section'], i['taxable'],
                 i['percent'], i['amount'], i['inv_no']] for i in items]
        exporter = ExcelExporter("TDS Report", company.company_name)
        return exporter.export(columns, data)
