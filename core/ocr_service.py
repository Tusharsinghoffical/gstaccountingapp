import pytesseract
from PIL import Image
import re
from pdf2image import convert_from_path
import os
import tempfile

class OCRInvoiceService:
    @staticmethod
    def extract_text(file_path):
        """Extracts text from PDF or Image."""
        ext = os.path.splitext(file_path)[1].lower()
        text = ""
        
        if ext == '.pdf':
            with tempfile.TemporaryDirectory() as path:
                pages = convert_from_path(file_path, output_folder=path)
                for page in pages:
                    text += pytesseract.image_to_string(page)
        else:
            text = pytesseract.image_to_string(Image.open(file_path))
            
        return text

    @staticmethod
    def parse_data(text):
        """Parses extracted text for key fields using regex."""
        data = {
            'gstin': None,
            'invoice_no': None,
            'invoice_date': None,
            'net_amount': 0.0,
            'items': []
        }
        
        # 1. GSTIN (15 characters)
        gstin_match = re.search(r'[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}', text)
        if gstin_match:
            data['gstin'] = gstin_match.group(0)
            
        # 2. Invoice Number
        inv_match = re.search(r'(?:Invoice No|Bill No|Inv #|No)\s*[:#-]?\s*([A-Za-z0-9/-]+)', text, re.I)
        if inv_match:
            data['invoice_no'] = inv_match.group(1)
            
        # 3. Date
        date_match = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', text)
        if date_match:
            data['invoice_date'] = date_match.group(1)
            
        # 4. Total Amount
        total_match = re.search(r'(?:Total|Grand Total|Net Payable|Amount|Net)\s*[:₹s]?\s*([\d,]+\.?\d*)', text, re.I)
        if total_match:
            amount_str = total_match.group(1).replace(',', '')
            try:
                data['net_amount'] = float(amount_str)
            except ValueError:
                pass
                
        return data
