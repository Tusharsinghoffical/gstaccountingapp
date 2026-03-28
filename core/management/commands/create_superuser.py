from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db.utils import IntegrityError


class Command(BaseCommand):
    help = 'Create or update superuser for production deployment'

    def handle(self, *args, **options):
        username = 'admin'
        email = 'admin@gstaccounting.com'
        password = 'Admin@123'  # Default password

        try:
            if User.objects.filter(username=username).exists():
                # Update existing user's password
                user = User.objects.get(username=username)
                user.set_password(password)
                user.is_staff = True
                user.is_superuser = True
                user.save()

                self.stdout.write(
                    self.style.SUCCESS(
                        f'\n✅ Superuser "{username}" updated successfully!\n\n'
                        f'Username: {username}\n'
                        f'Password: {password}\n\n'
                        f'⚠️  IMPORTANT: Change this password immediately after login!\n'
                        f'Go to: /admin/password_change/\n'
                    )
                )
                return

            # Create new superuser
            user = User.objects.create_superuser(
                username=username,
                email=email,
                password=password,
                is_staff=True,
                is_superuser=True
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f'\n✅ Superuser created successfully!\n\n'
                    f'Username: {username}\n'
                    f'Password: {password}\n\n'
                    f'⚠️  IMPORTANT: Change this password immediately after login!\n'
                    f'Go to: /admin/password_change/\n'
                )
            )

        except IntegrityError as e:
            self.stdout.write(
                self.style.ERROR(f'Error creating superuser: {str(e)}')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Unexpected error: {str(e)}')
            )
