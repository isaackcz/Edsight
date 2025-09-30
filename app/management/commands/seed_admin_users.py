from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from app.models import AdminUser, Region, Division, District, School
import bcrypt


class Command(BaseCommand):
    help = "Create one AdminUser per admin level (central, region, division, district, school)."

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Overwrite existing seeded users if they exist')

    def handle(self, *args, **options):
        force = options.get('force', False)

        created = []
        updated = []

        # Helper to hash password with bcrypt, matching login_view check
        def hash_password(raw: str) -> str:
            return bcrypt.hashpw(raw.encode(), bcrypt.gensalt()).decode()

        # Choose first available areas for assignment where relevant
        region = Region.objects.first()
        division = Division.objects.first()
        district = District.objects.first()
        school = School.objects.first()

        seeds = [
            {
                'username': 'central_admin',
                'email': 'central.admin@deped.gov.ph',
                'full_name': 'Central Admin',
                'admin_level': 'central',
                'assigned_area': 'Central Office',
                'defaults': {}
            },
            {
                'username': 'region_admin',
                'email': 'region.admin@deped.gov.ph',
                'full_name': 'Region Admin',
                'admin_level': 'region',
                'assigned_area': (region.name if region else 'Region'),
                'defaults': {'region_id': region.id if region else None}
            },
            {
                'username': 'division_admin',
                'email': 'division.admin@deped.gov.ph',
                'full_name': 'Division Admin',
                'admin_level': 'division',
                'assigned_area': (division.name if division else 'Division'),
                'defaults': {
                    'region_id': division.region_id if division else (region.id if region else None),
                    'division_id': division.id if division else None
                }
            },
            {
                'username': 'district_admin',
                'email': 'district.admin@deped.gov.ph',
                'full_name': 'District Admin',
                'admin_level': 'district',
                'assigned_area': (district.name if district else 'District'),
                'defaults': {
                    'region_id': district.division.region_id if district and district.division_id else (region.id if region else None),
                    'division_id': district.division_id if district else (division.id if division else None),
                    'district_id': district.id if district else None
                }
            },
            {
                'username': 'school_admin',
                'email': 'schooladmin@deped.gov.ph',
                'full_name': 'School Admin',
                'admin_level': 'school',
                'assigned_area': (school.school_name if school else 'School'),
                'defaults': {
                    'region_id': school.region_id if school else (region.id if region else None),
                    'division_id': school.division_id if school else (division.id if division else None),
                    'district_id': school.district_id if school else (district.id if district else None),
                    'school_id': school.id if school else None
                }
            }
        ]

        # Fallback assigned_area if no geo found
        for s in seeds:
            if not s['assigned_area']:
                s['assigned_area'] = s['admin_level'].capitalize()

        # Use a single default password across seeds; advise to change later
        default_password = 'EdSight.123'
        pwd_hash = hash_password(default_password)

        with transaction.atomic():
            for s in seeds:
                # Find existing by username or email to avoid unique collisions
                existing = AdminUser.objects.filter(username=s['username']).first()
                if not existing:
                    existing = AdminUser.objects.filter(email=s['email']).first()
                payload = {
                    'username': s['username'],
                    'email': s['email'],
                    'full_name': s['full_name'],
                    'admin_level': s['admin_level'],
                    'assigned_area': s['assigned_area'],
                    'status': 'active',
                    'password_hash': pwd_hash,
                    **s['defaults'],
                }

                if existing:
                    if force:
                        for k, v in payload.items():
                            setattr(existing, k, v)
                        existing.updated_at = timezone.now()
                        existing.save()
                        updated.append(existing.username)
                    else:
                        # Ensure active and password set at least
                        changed = False
                        if existing.status != 'active':
                            existing.status = 'active'
                            changed = True
                        if not existing.password_hash:
                            existing.password_hash = pwd_hash
                            changed = True
                        if changed:
                            existing.save()
                            updated.append(existing.username)
                else:
                    obj = AdminUser.objects.create(**payload)
                    created.append(obj.username)

        self.stdout.write(self.style.SUCCESS('Seed admin users completed.'))
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created: {', '.join(created)}"))
        if updated:
            self.stdout.write(self.style.WARNING(f"Updated: {', '.join(updated)}"))
        self.stdout.write(self.style.NOTICE("Default password for all seeded users: EdSight.123"))


