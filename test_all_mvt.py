import os
import django
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gst_accounting.settings')
django.setup()

from django.conf import settings
if 'testserver' not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS.append('testserver')

from django.test import Client
from django.urls import get_resolver
from django.contrib.auth.models import User

def run_tests():
    client = Client()
    user = User.objects.filter(username='admin').first()
    if not user:
        user = User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    client.force_login(user)

    resolver = get_resolver()
    url_patterns = resolver.url_patterns

    def extract_urls(patterns, prefix=''):
        urls = []
        for p in patterns:
            if hasattr(p, 'url_patterns'):
                extracted = extract_urls(p.url_patterns, prefix + str(p.pattern))
                urls.extend(extracted)
            else:
                urls.append((prefix + str(p.pattern), p.name))
        return urls

    all_paths = extract_urls(url_patterns)
    
    print(f"Found {len(all_paths)} URL patterns to test.")
    
    bugs_found = []

    for path, name in all_paths:
        test_path = path.replace('^', '').replace('$', '')
        test_path = test_path.replace('(?P<pk>[0-9]+)/', '1/')
        test_path = test_path.replace('<int:pk>/', '1/')
        test_path = test_path.replace('<str:pk>/', '1/')
        test_path = test_path.replace(r'\Z', '')
        
        if 'admin' in test_path or 'static' in test_path or 'media' in test_path:
            continue

        if not test_path.startswith('/'):
            test_path = '/' + test_path

        try:
            print(f"Testing GET {test_path} (name: {name})...", end=" ")
            response = client.get(test_path)
            if response.status_code in [200, 301, 302, 404]: # 404 is fine if dummy ID 1 doesn't exist
                print(f"OK ({response.status_code})")
            else:
                print(f"FAILED ({response.status_code})")
                bugs_found.append(f"GET {test_path} returned {response.status_code}")
                
            if 'add' in test_path or 'edit' in test_path or 'form' in test_path:
                print(f"  Testing POST {test_path}...", end=" ")
                response_post = client.post(test_path, {})
                if response_post.status_code in [200, 301, 302, 400, 404]:
                    print(f"OK ({response_post.status_code})")
                else:
                    print(f"FAILED ({response_post.status_code})")
                    bugs_found.append(f"POST {test_path} returned {response_post.status_code}")
                    
        except Exception as e:
            print(f"ERROR: {type(e).__name__}: {e}")
            bugs_found.append(f"Exception on {test_path}: {type(e).__name__}: {e}")

    print("\n--- TEST SUMMARY ---")
    if not bugs_found:
        print("✅ No MVT or connectivity bugs found. All pages returned 200/302/404.")
    else:
        print(f"❌ Found {len(bugs_found)} potential bugs:")
        for bug in bugs_found:
            print(f"  - {bug}")

if __name__ == '__main__':
    run_tests()
