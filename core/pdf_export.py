from django.template.loader import render_to_string
from django.http import HttpResponse
from .views import WEASYPRINT_AVAILABLE, HTML
import tempfile
import os

def render_to_pdf(template_src, context_dict={}):
    html_string = render_to_string(template_src, context_dict)
    if WEASYPRINT_AVAILABLE:
        html = HTML(string=html_string)
        result = html.write_pdf()
        response = HttpResponse(content_type='application/pdf')
        with tempfile.NamedTemporaryFile(delete=True) as output:
            output.write(result)
            output.flush()
            output = open(output.name, 'rb')
            response.write(output.read())
        return response
    return HttpResponse(html_string)
