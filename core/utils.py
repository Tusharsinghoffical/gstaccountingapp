from datetime import date

def get_fiscal_year(d=None):
    if d is None:
        d = date.today()
    if d.month > 3:
        return f"{d.year}-{str(d.year + 1)[2:]}"
    else:
        return f"{d.year - 1}-{str(d.year)[2:]}"

def get_fy_range(fy_str):
    start_year = int(fy_str.split('-')[0])
    return date(start_year, 4, 1), date(start_year + 1, 3, 31)

def generate_invoice_no(model_class, fy_str):
    prefix = f"SI-{fy_str}-"
    last_invoice = model_class.objects.filter(invoice_no__startswith=prefix).order_by('-invoice_no').first()
    if not last_invoice:
        return f"{prefix}0001"
    
    last_no = int(last_invoice.invoice_no.split('-')[-1])
    new_no = str(last_no + 1).zfill(4)
    return f"{prefix}{new_no}"
