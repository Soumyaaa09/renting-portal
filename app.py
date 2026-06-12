import random
from flask import Flask, render_template, request, redirect, session
from flask_mail import Mail, Message
from supabase_client import supabase
import bcrypt
from datetime import datetime, timedelta
import base64
import uuid
import os
import traceback
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "secret123")

try:
    mail_port = int(os.environ.get("MAIL_PORT", 587))
except (ValueError, TypeError):
    mail_port = 587

app.config.update(
    MAIL_SERVER=os.environ.get("MAIL_SERVER", "smtp.gmail.com"),
    MAIL_PORT=mail_port,
    MAIL_USE_TLS=os.environ.get("MAIL_USE_TLS", "True").lower() in ("true", "1", "yes"),
    MAIL_USE_SSL=os.environ.get("MAIL_USE_SSL", "False").lower() in ("true", "1", "yes"),
    MAIL_USERNAME=os.environ.get("MAIL_USERNAME", "").strip(),
    MAIL_PASSWORD=os.environ.get("MAIL_PASSWORD", os.environ.get("MAIL_APP_PASSWORD", "")).replace(" ", "").strip(),
    MAIL_DEFAULT_SENDER=os.environ.get("MAIL_FROM") or os.environ.get("MAIL_USERNAME", "").strip(),
)

try:
    mail = Mail(app)
except Exception as e:
    print(f"Warning: Flask-Mail initialization failed: {e}")
    mail = None

print("App startup: SUPABASE_URL set:", bool(os.environ.get("SUPABASE_URL")))
print("App startup: SUPABASE_KEY set:", bool(os.environ.get("SUPABASE_KEY")))
print("App startup: MAIL_USERNAME set:", bool(app.config.get("MAIL_USERNAME")))
print("App startup: MAIL_DEFAULT_SENDER set:", bool(app.config.get("MAIL_DEFAULT_SENDER")))


def establish_user_session(user):
    user_id = user.get('id')
    role = user.get('role')
    name = user.get('name')

    if user_id is None or not role or not name:
        raise ValueError("User record is missing required fields.")

    session['user_id'] = user_id
    session['role'] = role
    session['user_name'] = name
    session.permanent = True

    return '/admin' if role == 'admin' else '/dashboard'


def mail_config_ready():
    smtp_user = app.config.get("MAIL_USERNAME", "")
    smtp_pass = app.config.get("MAIL_PASSWORD", "")

    if not smtp_user:
        print("Email config: MAIL_USERNAME is missing")
    if not smtp_pass:
        print("Email config: MAIL_PASSWORD / MAIL_APP_PASSWORD is missing")

    return bool(smtp_user and smtp_pass)


def send_otp_email_with_nodemailer(to_email, otp):
    if mail is None:
        print("Email error: Flask-Mail is not initialized.")
        return False
    
    if not mail_config_ready():
        print("Email error: Mail configuration is incomplete.")
        return False

    try:
        msg = Message(
            subject="Your DriveNow Login OTP",
            recipients=[to_email],
            html=f"<p>Your one-time login code is: <strong>{otp}</strong></p>"
        )
        mail.send(msg)
        print(f"OTP email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"Email error: {e}")
        traceback.print_exc()
        return False


# ---------------- HOME ----------------
@app.route('/')
def home():
    return redirect('/login')


# ---------------- REGISTER ----------------
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip().lower()
        phone = request.form.get('phone', '').strip()
        password = request.form.get('password', '')

        if not all([name, email, phone, password]):
            return render_template('register.html', message="Please fill in all fields.")

        hashed_password = bcrypt.hashpw(
            password.encode('utf-8'),
            bcrypt.gensalt()
        )

        data = {
            "name": name,
            "email": email,
            "phone": phone,
            "password": hashed_password.decode('utf-8'),
            "role": "customer"
        }

        try:
            existing_user = supabase.table("users").select("id").eq("email", email).limit(1).execute().data
            if existing_user:
                return render_template('register.html', message="An account with this email already exists.")

            supabase.table("users").insert(data).execute()
        except Exception as e:
            print(f"Register error: {e}")
            return render_template(
                'register.html',
                message="Registration is temporarily unavailable. Please check the Supabase configuration and try again."
            )

        return redirect('/login')

    return render_template('register.html')


# ---------------- LOGIN (step 1 — send OTP) ----------------
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email  = request.form.get('email', '').strip().lower()
        method = request.form.get('method', 'otp')
        if not email:
            return render_template('login.html', message="Please enter your email address.", method=method)

        try:
            user = supabase.table("users").select("*").eq("email", email).execute().data
        except Exception as e:
            print(f"Login error: {e}")
            return render_template(
                'login.html',
                message="Login is temporarily unavailable. Please check the Supabase configuration and try again.",
                method=method
            )

        if not user:
            return render_template('login.html', message="No account found with this email.", method=method)
        user = user[0]

        # ── PASSWORD login ──────────────────────────────────
        if method == 'password':
            password = request.form.get('password', '')
            stored   = user.get('password', '')
            try:
                if stored and stored.startswith('$2b$'):
                    valid = bcrypt.checkpw(password.encode('utf-8'), stored.encode('utf-8'))
                else:
                    valid = (password == stored)
            except ValueError as e:
                print(f"Password verification error for {email}: {e}")
                valid = False

            if not valid:
                return render_template(
                    'login.html',
                    message="Incorrect password. Try OTP login instead.",
                    method='password'
                )

            try:
                return redirect(establish_user_session(user))
            except ValueError as e:
                print(f"Login session error for {email}: {e}")
                return render_template(
                    'login.html',
                    message="Your account is missing required profile fields. Please contact support.",
                    method='password'
                )

        # ── OTP login ───────────────────────────────────────
        otp = str(random.randint(100000, 999999))
        session['otp']         = otp
        session['otp_email']   = email
        session['otp_expires'] = (datetime.now().timestamp() + 600)

        sent = send_otp_email_with_nodemailer(email, otp)
        if not sent:
            return render_template(
                'login.html',
                message="Failed to send OTP email. Check mail settings on the server or use password login.",
                method='otp'
            )

        return redirect('/verify-otp')

    return render_template('login.html', method='otp')


# ---------------- LOGIN (step 2 — verify OTP) ----------------
@app.route('/verify-otp', methods=['GET', 'POST'])
def verify_otp():
    if 'otp' not in session:
        return redirect('/login')

    if request.method == 'POST':
        entered = request.form.get('otp', '').strip()
        if not entered:
            return render_template('verify_otp.html', message="Please enter the OTP code.", email=session.get('otp_email', ''))

        if datetime.now().timestamp() > session.get('otp_expires', 0):
            session.pop('otp', None)
            return render_template('verify_otp.html', message="OTP expired. Please login again.", email=session.get('otp_email',''))

        if entered != session.get('otp'):
            return render_template('verify_otp.html', message="Incorrect OTP. Please try again.", email=session.get('otp_email',''))

        # OTP correct — log the user in
        email = session.pop('otp_email')
        session.pop('otp', None)
        session.pop('otp_expires', None)

        try:
            user_rows = supabase.table("users").select("*").eq("email", email).execute().data
        except Exception as e:
            print(f"Verify OTP error: {e}")
            return render_template(
                'verify_otp.html',
                message="Verification is temporarily unavailable. Please try again later.",
                email=email
            )

        if not user_rows:
            return render_template(
                'verify_otp.html',
                message="No account found for this email. Please sign in again.",
                email=email
            )

        user = user_rows[0]
        try:
            return redirect(establish_user_session(user))
        except ValueError as e:
            print(f"Verify OTP session error for {email}: {e}")
            return render_template(
                'verify_otp.html',
                message="Your account is missing required profile fields. Please contact support.",
                email=email
            )

    return render_template('verify_otp.html', email=session.get('otp_email', ''))


# ---------------- RESEND OTP ----------------
@app.route('/resend-otp')
def resend_otp():
    email = session.get('otp_email')
    if not email:
        return redirect('/login')

    otp = str(random.randint(100000, 999999))
    session['otp']         = otp
    session['otp_expires'] = (datetime.now().timestamp() + 600)

    send_otp_email_with_nodemailer(email, otp)
    return redirect('/verify-otp')



# ---------------- MAINTENANCE MODE ─────────────────────────
def is_maintenance():
    try:
        row = supabase.table("settings").select("value").eq("key", "maintenance_mode").execute().data
        return row and row[0]['value'] == 'true'
    except Exception:
        return False

@app.before_request
def check_maintenance():
    # Skip for admin routes, static files, login, logout
    allowed = ['/admin', '/login', '/logout', '/register', '/verify-otp',
               '/resend-otp', '/static']
    if any(request.path.startswith(p) for p in allowed):
        return None
    # Also skip if user is admin
    if session.get('role') == 'admin':
        return None
    if is_maintenance():
        return render_template('maintenance.html'), 503


@app.route('/admin/maintenance/on',  methods=['POST'])
def maintenance_on():
    if session.get('role') != 'admin':
        return redirect('/login')
    try:
        existing = supabase.table("settings").select("id").eq("key", "maintenance_mode").execute().data
        if existing:
            supabase.table("settings").update({"value": "true"}).eq("key", "maintenance_mode").execute()
        else:
            supabase.table("settings").insert({"key": "maintenance_mode", "value": "true"}).execute()
    except Exception:
        pass
    return redirect('/admin')


@app.route('/admin/maintenance/off', methods=['POST'])
def maintenance_off():
    if session.get('role') != 'admin':
        return redirect('/login')
    try:
        supabase.table("settings").update({"value": "false"}).eq("key", "maintenance_mode").execute()
    except Exception:
        pass
    return redirect('/admin')


# ---------------- DASHBOARD ----------------
@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect('/login')

    return render_template('dashboard.html')


# ---------------- VEHICLES ----------------
@app.route('/vehicles')
def vehicles_page():
    if 'user_id' not in session:
        return redirect('/login')

    from datetime import datetime
    vehicles = supabase.table("vehicles").select("*").execute().data

    # Check which vehicles are booked RIGHT NOW
    now       = datetime.now()
    today     = now.strftime("%Y-%m-%d")
    now_time  = now.strftime("%H:%M")

    active_bookings = supabase.table("bookings") \
        .select("vehicle_name,start_time,end_time") \
        .eq("booking_date", today) \
        .eq("status", "approved") \
        .execute().data

    booked_now = set()
    for b in active_bookings:
        b_start = b['start_time'][:5]
        b_end   = b['end_time'][:5]
        if b_start <= now_time <= b_end:
            booked_now.add(b['vehicle_name'])

    return render_template('vehicles.html', vehicles=vehicles,
                           role=session.get('role'), booked_now=booked_now)



# ---------------- ADMIN FLEET LIST ----------------
@app.route('/admin/vehicles')
def admin_vehicles():
    if session.get('role') != 'admin':
        return redirect('/login')
    vehicles = supabase.table("vehicles").select("*").execute().data
    return render_template('admin_vehicles.html', vehicles=vehicles)


# ---------------- EDIT VEHICLE ----------------
@app.route('/admin/edit-vehicle/<vehicle_id>', methods=['GET', 'POST'])
def edit_vehicle(vehicle_id):
    if session.get('role') != 'admin':
        return redirect('/login')

    vehicle = supabase.table("vehicles").select("*").eq("id", vehicle_id).execute().data[0]

    if request.method == 'POST':
        updates = {
            "name":        request.form['name'],
            "type":        request.form['type'],
            "price":       int(request.form['price']),
            "fuel_type":   request.form.get('fuel_type') or None,
            "seats":       int(request.form['seats']) if request.form.get('seats') else None,
            "description": request.form.get('description') or None,
        }

        image_file = request.files.get('image_file')
        if image_file and image_file.filename != '':
            ext      = image_file.filename.rsplit('.', 1)[-1].lower()
            img_path = f"vehicles/{uuid.uuid4().hex}.{ext}"
            try:
                supabase.storage.from_("documents").upload(img_path, image_file.read(),
                    {"content-type": image_file.content_type, "upsert": "true"})
                updates["image_url"] = supabase.storage.from_("documents").get_public_url(img_path)
            except Exception:
                pass

        supabase.table("vehicles").update(updates).eq("id", vehicle_id).execute()
        vehicle = supabase.table("vehicles").select("*").eq("id", vehicle_id).execute().data[0]
        return render_template('edit_vehicle.html', vehicle=vehicle, message="Changes saved successfully!")

    return render_template('edit_vehicle.html', vehicle=vehicle, message=None)


# ---------------- ADD VEHICLE ----------------
@app.route('/admin/add-vehicle', methods=['GET', 'POST'])
def add_vehicle():
    if session.get('role') != 'admin':
        return redirect('/login')

    if request.method == 'POST':
        image_url  = None
        image_file = request.files.get('image_file')
        if image_file and image_file.filename != '':
            ext      = image_file.filename.rsplit('.', 1)[-1].lower()
            img_path = f"vehicles/{uuid.uuid4().hex}.{ext}"
            try:
                supabase.storage.from_("documents").upload(img_path, image_file.read(),
                    {"content-type": image_file.content_type, "upsert": "true"})
                image_url = supabase.storage.from_("documents").get_public_url(img_path)
            except Exception:
                pass

        supabase.table("vehicles").insert({
            "name":      request.form['name'],
            "type":      request.form['type'],
            "price":     int(request.form['price']),
            "image_url": image_url
        }).execute()
        return redirect('/admin/vehicles')

    return render_template('add_vehicle.html')


# ---------------- DELETE VEHICLE ----------------
@app.route('/admin/delete-vehicle/<vehicle_id>', methods=['POST'])
def delete_vehicle(vehicle_id):
    if session.get('role') != 'admin':
        return redirect('/login')
    supabase.table("vehicles").delete().eq("id", vehicle_id).execute()
    return redirect('/admin/vehicles')


# ---------------- UPLOAD DOCUMENTS ----------------
@app.route('/upload-docs', methods=['GET', 'POST'])
def upload_docs():
    if 'user_id' not in session:
        return redirect('/login')

    next_url = request.args.get('next', '/vehicles')

    if request.method == 'POST':
        dl_file = request.files.get('dl_file')
        aadhaar_file = request.files.get('aadhaar_file')

        errors = []
        if not dl_file or dl_file.filename == '':
            errors.append("Driving Licence is required.")
        if not aadhaar_file or aadhaar_file.filename == '':
            errors.append("Aadhaar Card is required.")

        if errors:
            return render_template('upload_docs.html', errors=errors, next=next_url)

        uid = str(session['user_id'])

        # Upload DL
        dl_ext = dl_file.filename.rsplit('.', 1)[-1].lower()
        dl_path = f"{uid}/dl_{uuid.uuid4().hex}.{dl_ext}"
        dl_bytes = dl_file.read()
        supabase.storage.from_("documents").upload(dl_path, dl_bytes,
            {"content-type": dl_file.content_type, "upsert": "true"})

        # Upload Aadhaar
        ad_ext = aadhaar_file.filename.rsplit('.', 1)[-1].lower()
        ad_path = f"{uid}/aadhaar_{uuid.uuid4().hex}.{ad_ext}"
        ad_bytes = aadhaar_file.read()
        supabase.storage.from_("documents").upload(ad_path, ad_bytes,
            {"content-type": aadhaar_file.content_type, "upsert": "true"})

        # Get public URLs and save to user record
        dl_url      = supabase.storage.from_("documents").get_public_url(dl_path)
        aadhaar_url = supabase.storage.from_("documents").get_public_url(ad_path)

        try:
            supabase.table("users").update({
                "dl_url":      dl_url,
                "aadhaar_url": aadhaar_url
            }).eq("id", uid).execute()
        except Exception:
            pass  # columns may not exist yet, upload still succeeds

        session.permanent = True
        session['docs_uploaded'] = True
        return redirect(next_url)

    return render_template('upload_docs.html', errors=[], next=next_url)


# ---------------- BOOK VEHICLE ----------------
@app.route('/book/<vehicle_id>', methods=['GET', 'POST'])
def book(vehicle_id):
    if 'user_id' not in session:
        return redirect('/login')

    vehicle = supabase.table("vehicles").select("*").eq("id", vehicle_id).execute().data[0]

    if request.method == 'POST':

        booking_date = request.form['booking_date']
        start_time = request.form['start_time']
        end_time = request.form['end_time']

        # Handle document uploads
        dl_file      = request.files.get('dl_file')
        aadhaar_file = request.files.get('aadhaar_file')

        if not dl_file or dl_file.filename == '':
            return render_template('book.html', vehicle=vehicle, message="Please upload your Driving Licence.", show_form=True)
        if not aadhaar_file or aadhaar_file.filename == '':
            return render_template('book.html', vehicle=vehicle, message="Please upload your Aadhaar Card.", show_form=True)

        uid = str(session['user_id'])
        try:
            dl_ext  = dl_file.filename.rsplit('.', 1)[-1].lower()
            dl_path = f"{uid}/dl_{uuid.uuid4().hex}.{dl_ext}"
            supabase.storage.from_("documents").upload(dl_path, dl_file.read(),
                {"content-type": dl_file.content_type, "upsert": "true"})

            ad_ext  = aadhaar_file.filename.rsplit('.', 1)[-1].lower()
            ad_path = f"{uid}/aadhaar_{uuid.uuid4().hex}.{ad_ext}"
            supabase.storage.from_("documents").upload(ad_path, aadhaar_file.read(),
                {"content-type": aadhaar_file.content_type, "upsert": "true"})

            dl_url      = supabase.storage.from_("documents").get_public_url(dl_path)
            aadhaar_url = supabase.storage.from_("documents").get_public_url(ad_path)
            supabase.table("users").update({
                "dl_url": dl_url, "aadhaar_url": aadhaar_url
            }).eq("id", uid).execute()
        except Exception:
            pass  # storage errors won't block booking

        start = datetime.strptime(start_time, "%H:%M")
        end = datetime.strptime(end_time, "%H:%M")

        if end <= start:
            return render_template('book.html', vehicle=vehicle, message="End time must be after start time.", show_form=True)

        # 🚫 overlap check — check by vehicle_id OR vehicle_name to cover old bookings
        existing = supabase.table("bookings") \
            .select("start_time,end_time,status") \
            .eq("vehicle_name", vehicle['name']) \
            .eq("booking_date", booking_date) \
            .neq("status", "rejected") \
            .neq("status", "cancelled") \
            .execute().data

        for b in existing:
            b_start = b['start_time'][:5]
            b_end   = b['end_time'][:5]
            s_start = start_time[:5]
            s_end   = end_time[:5]
            if s_start < b_end and s_end > b_start:
                return render_template('book.html', vehicle=vehicle, show_form=True,
                    message=f"⚠ This vehicle is already booked from {b_start} to {b_end} on this date. Please choose a different time slot.")

        # 💰 price calculation
        hours = (end - start).seconds / 3600
        total_price = int(hours * vehicle['price'])

        # Store booking in session for after payment
        session['pending_booking'] = {
            "user_id":      str(session['user_id']),
            "user_name":    session['user_name'],
            "vehicle_id":   vehicle_id,
            "vehicle_name": vehicle['name'],
            "price":        total_price,
            "booking_date": booking_date,
            "start_time":   start_time,
            "end_time":     end_time,
        }

        return render_template('book.html', vehicle=vehicle,
                               show_payment=True,
                               total_price=total_price)

    return render_template('book.html', vehicle=vehicle)


# ---------------- UPI PAYMENT SUCCESS ----------------
@app.route('/payment-success', methods=['POST'])
def payment_success():
    if 'user_id' not in session:
        return redirect('/login')

    booking = session.pop('pending_booking', None)
    if not booking:
        return redirect('/vehicles')

    # Upload screenshot to Supabase storage
    screenshot_url = None
    screenshot = request.files.get('payment_screenshot')
    if screenshot and screenshot.filename:
        try:
            ext  = screenshot.filename.rsplit('.', 1)[-1].lower()
            path = f"payments/{str(session['user_id'])[:8]}_{uuid.uuid4().hex[:8]}.{ext}"
            supabase.storage.from_("documents").upload(
                path, screenshot.read(),
                {"content-type": screenshot.content_type, "upsert": "true"}
            )
            screenshot_url = supabase.storage.from_("documents").get_public_url(path)
        except Exception:
            screenshot_url = None

    supabase.table("bookings").insert({
        "user_id":            booking["user_id"],
        "user_name":          booking["user_name"],
        "vehicle_id":         booking["vehicle_id"],
        "vehicle_name":       booking["vehicle_name"],
        "price":              booking["price"],
        "booking_date":       booking["booking_date"],
        "start_time":         booking["start_time"],
        "end_time":           booking["end_time"],
        "status":             "pending",
        "payment_screenshot": screenshot_url,
        "booking_fee_paid":   True
    }).execute()

    return redirect('/my-bookings?paid=1')


# ---------------- MY BOOKINGS ----------------
@app.route('/my-bookings')
def my_bookings():
    if 'user_id' not in session:
        return redirect('/login')
    if session.get('role') == 'admin':
        return redirect('/admin/bookings')

    user_id = session['user_id']
    bookings = supabase.table("bookings") \
        .select("*") \
        .eq("user_id", str(user_id)) \
        .order("id", desc=True) \
        .execute().data

    if not bookings and not isinstance(user_id, str):
        bookings = supabase.table("bookings") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("id", desc=True) \
            .execute().data

    return render_template('my_bookings.html', bookings=bookings)


# ---------------- ADMIN DASHBOARD ----------------
@app.route('/admin')
def admin():
    if session.get('role') != 'admin':
        return redirect('/login')

    bookings = supabase.table("bookings").select("*").execute().data

    total = len(bookings)
    pending = len([b for b in bookings if b['status'] == 'pending'])
    approved = len([b for b in bookings if b['status'] == 'approved'])
    rejected = len([b for b in bookings if b['status'] == 'rejected'])

    return render_template('admin.html',
                           total=total,
                           pending=pending,
                           approved=approved,
                           rejected=rejected,
                           maintenance=is_maintenance())


# ---------------- ADMIN BOOKINGS ----------------
@app.route('/admin/bookings')
def admin_bookings():
    if session.get('role') != 'admin':
        return redirect('/login')

    bookings = supabase.table("bookings").select("*").order("id", desc=True).execute().data

    # Fetch dl_url and aadhaar_url for each booking's user
    user_ids = list(set(b['user_id'] for b in bookings if b.get('user_id')))
    users_map = {}
    if user_ids:
        users = supabase.table("users").select("id,dl_url,aadhaar_url").in_("id", user_ids).execute().data
        users_map = {str(u['id']): u for u in users}

    # Attach docs to each booking
    for b in bookings:
        user = users_map.get(str(b.get('user_id')), {})
        b['dl_url']      = user.get('dl_url')
        b['aadhaar_url'] = user.get('aadhaar_url')

    return render_template('admin_bookings.html', bookings=bookings)


# ---------------- APPROVE ----------------
@app.route('/approve/<booking_id>')
def approve(booking_id):
    if session.get('role') != 'admin':
        return redirect('/login')

    booking_rows = supabase.table("bookings").select("*").eq("id", booking_id).execute().data
    if not booking_rows:
        return redirect('/admin/bookings')

    booking = booking_rows[0]

    if booking['status'] != 'pending':
        return redirect('/admin/bookings')

    supabase.table("bookings") \
        .update({"status": "approved"}) \
        .eq("id", booking_id) \
        .execute()

    return redirect('/admin/bookings')


# ---------------- REJECT ----------------
@app.route('/reject/<booking_id>')
def reject(booking_id):
    if session.get('role') != 'admin':
        return redirect('/login')

    booking_rows = supabase.table("bookings").select("*").eq("id", booking_id).execute().data
    if not booking_rows:
        return redirect('/admin/bookings')

    booking = booking_rows[0]

    if booking['status'] != 'pending':
        return redirect('/admin/bookings')

    supabase.table("bookings") \
        .update({"status": "rejected"}) \
        .eq("id", booking_id) \
        .execute()

    return redirect('/admin/bookings')


# ---------------- RATE BOOKING ----------------
@app.route('/rate/<booking_id>', methods=['GET', 'POST'])
def rate_booking(booking_id):
    if 'user_id' not in session:
        return redirect('/login')

    booking = supabase.table("bookings").select("*").eq("id", booking_id).eq("user_id", str(session['user_id'])).execute().data
    if not booking:
        return redirect('/my-bookings')
    booking = booking[0]

    if booking['status'] != 'approved':
        return redirect('/my-bookings')

    # Check if already rated
    existing = supabase.table("reviews").select("id").eq("booking_id", booking_id).execute().data
    if existing:
        return redirect('/my-bookings')

    if request.method == 'POST':
        stars   = int(request.form['stars'])
        comment = request.form.get('comment', '').strip()

        supabase.table("reviews").insert({
            "booking_id":   booking_id,
            "user_id":      str(session['user_id']),
            "user_name":    session['user_name'],
            "vehicle_id":   booking['vehicle_id'],
            "vehicle_name": booking['vehicle_name'],
            "stars":        stars,
            "comment":      comment
        }).execute()

        return redirect('/my-bookings?rated=1')

    return render_template('rate_booking.html', booking=booking)


# ---------------- VEHICLE REVIEWS (public) ----------------
@app.route('/reviews/<vehicle_id>')
def vehicle_reviews(vehicle_id):
    reviews = supabase.table("reviews").select("*").eq("vehicle_id", vehicle_id).order("id", desc=True).execute().data
    vehicle = supabase.table("vehicles").select("*").eq("id", vehicle_id).execute().data[0]
    avg = round(sum(r['stars'] for r in reviews) / len(reviews), 1) if reviews else None
    return render_template('vehicle_reviews.html', reviews=reviews, vehicle=vehicle, avg=avg)


# ---------------- LOGOUT ----------------
@app.route('/logout')
def logout():
    session.clear()
    return redirect('/login')


@app.errorhandler(Exception)
def handle_exception(error):
    traceback.print_exc()
    return render_template('error.html', error_message=str(error)), 500


# ---------------- RUN ----------------
if __name__ == '__main__':
    app.run(debug=True)
