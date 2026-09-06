-- Add category column to invoices table for purchase invoice classification
-- Categories: Office Supplies, Raw Materials, Utilities, Professional Services, Travel, Other

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS category TEXT CHECK (
  category IS NULL OR category IN (
    'Office Supplies',
    'Raw Materials',
    'Utilities',
    'Professional Services',
    'Travel',
    'Other'
  )
);

CREATE INDEX IF NOT EXISTS idx_invoices_category ON invoices(business_id, category);
