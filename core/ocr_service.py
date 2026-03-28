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

        # 1. GSTIN (15 characters) - search entire text
        gstin_match = re.search(
            r'[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}', text)
        if gstin_match:
            data['gstin'] = gstin_match.group(0)

        # 2. Invoice/Bill Number - multiple patterns for better detection
        # Try specific patterns first
        bill_patterns = [
            r'(?:Bill\s*No|Bill\s*#)\s*[:#-]?\s*([A-Za-z0-9/\-]+)',
            r'(?:Invoice\s*No|Invoice\s*#|Inv\s*#)\s*[:#-]?\s*([A-Za-z0-9/\-]+)',
            # Pattern like SI-2025-26-0001
            r'(?:SI\s*[-:]?\s*[0-9]+\s*[-/]\s*[0-9]+\s*[-/]\s*[0-9]+)',
            # Generic invoice pattern
            r'(?:No\.?\s*[:#]?\s*([A-Z]{1,3}[-]?[0-9]{4,}))',
        ]

        for pattern in bill_patterns:
            inv_match = re.search(pattern, text, re.I)
            if inv_match:
                data['invoice_no'] = inv_match.group(1) if len(
                    inv_match.groups()) > 0 else inv_match.group(0)
                break

        # 3. Date - multiple formats
        date_patterns = [
            r'(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
            r'(\d{1,2}\s+\w{3,9}\s+\d{4})',
            r'(\d{4}[-/]\d{1,2}[-/]\d{1,2})'
        ]

        for pattern in date_patterns:
            date_match = re.search(pattern, text, re.I)
            if date_match:
                data['invoice_date'] = date_match.group(1)
                break

        # 4. Total Amount - search for various total labels
        amount_patterns = [
            r'(?:Grand\s*Total|Total\s*Amount|Net\s*Payable|Total\s*\(INR\))\s*[:₹]?\s*([\d,]+\.?\d*)',
            r'(?:Total)\s*[:₹]?\s*([\d,]+\.?\d*)',
            r'₹\s*([\d,]+\.?\d*)'
        ]

        for pattern in amount_patterns:
            total_match = re.search(pattern, text, re.I)
            if total_match:
                amount_str = total_match.group(1).replace(',', '')
                try:
                    data['net_amount'] = float(amount_str)
                    break
                except ValueError:
                    pass

        return data
