from flask import Flask, render_template, request, redirect, session
from supabase_client import supabase
import bcrypt
from datetime import datetime
import base64
import uuid

app = Flask(__name__)
app.secret_key = "secret123"

# ---------------- HOME ----------------
@app.route('/')
def home():
    return redirect('/login')


# ---------------- REGISTER ----------------
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':

        hashed_password = bcrypt.hashpw(
            request.form['password'].encode('utf-8'),
            bcrypt.gensalt()
        )

        data = {
            "name": request.form['name'],
            "email": request.form['email'],
            "phone": request.form['phone'],
            "password": hashed_password.decode('utf-8'),
            "role": "customer"
        }

        supabase.table("users").insert(data).execute()
        return redirect('/login')

    return render_template('register.html')


# ---------------- LOGIN ----------------
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':

        email = request.form['email']
        password = request.form['password']

        response = supabase.table("users").select("*").eq("email", email).execute()
        user = response.data

        if user:
            user = user[0]

            stored_password = user['password']

            if stored_password.startswith('$2b$'):
                # bcrypt password
                valid = bcrypt.checkpw(password.encode('utf-8'), stored_password.encode('utf-8'))
            else:
                # plain password (old users)
                valid = (password == stored_password)

            if valid:
                session['user_id'] = user['id']
                session['role'] = user['role']
                session['user_name'] = user['name']

                if user['role'] == 'admin':
                    return redirect('/admin')
                else:
                    return redirect('/dashboard')
            else:
                return render_template('login.html', message="Invalid Password")
        else:
            return render_template('login.html', message="User not found")

    return render_template('login.html')


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

    vehicles = supabase.table("vehicles").select("*").execute().data
    return render_template('vehicles.html', vehicles=vehicles, role=session.get('role'))


# ---------------- ADD VEHICLE (ADMIN) ----------------
@app.route('/admin/add-vehicle', methods=['GET', 'POST'])
def add_vehicle():
    if session.get('role') != 'admin':
        return redirect('/login')

    if request.method == 'POST':
        supabase.table("vehicles").insert({
            "name": request.form['name'],
            "type": request.form['type'],
            "price": int(request.form['price'])  # per hour
        }).execute()

        return redirect('/vehicles')

    return render_template('add_vehicle.html')


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
            return render_template('book.html', vehicle=vehicle, message="Please upload your Driving Licence.")
        if not aadhaar_file or aadhaar_file.filename == '':
            return render_template('book.html', vehicle=vehicle, message="Please upload your Aadhaar Card.")

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

        # ❌ invalid time
        if end <= start:
            return render_template('book.html', vehicle=vehicle, message="Invalid time selection")

        # 🚫 overlap check
        existing = supabase.table("bookings") \
            .select("*") \
            .eq("vehicle_name", vehicle['name']) \
            .eq("booking_date", booking_date) \
            .execute().data

        for b in existing:
            if start_time < b['end_time'] and end_time > b['start_time']:
                return render_template('book.html', vehicle=vehicle, message="Time slot already booked")

        # 💰 price calculation
        hours = (end - start).seconds / 3600
        total_price = int(hours * vehicle['price'])

        supabase.table("bookings").insert({
            "user_id": session['user_id'],
            "user_name": session['user_name'],
            "vehicle_name": vehicle['name'],
            "price": total_price,
            "booking_date": booking_date,
            "start_time": start_time,
            "end_time": end_time,
            "status": "pending"
        }).execute()

        return redirect('/my-bookings')

    return render_template('book.html', vehicle=vehicle)


# ---------------- MY BOOKINGS ----------------
@app.route('/my-bookings')
def my_bookings():
    if 'user_id' not in session:
        return redirect('/login')

    bookings = supabase.table("bookings") \
        .select("*") \
        .eq("user_id", session['user_id']) \
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
                           rejected=rejected)


# ---------------- ADMIN BOOKINGS ----------------
@app.route('/admin/bookings')
def admin_bookings():
    if session.get('role') != 'admin':
        return redirect('/login')

    bookings = supabase.table("bookings").select("*").execute().data
    return render_template('admin_bookings.html', bookings=bookings)


# ---------------- APPROVE ----------------
@app.route('/approve/<booking_id>')
def approve(booking_id):

    booking = supabase.table("bookings").select("*").eq("id", booking_id).execute().data[0]

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

    booking = supabase.table("bookings").select("*").eq("id", booking_id).execute().data[0]

    if booking['status'] != 'pending':
        return redirect('/admin/bookings')

    supabase.table("bookings") \
        .update({"status": "rejected"}) \
        .eq("id", booking_id) \
        .execute()

    return redirect('/admin/bookings')


# ---------------- LOGOUT ----------------
@app.route('/logout')
def logout():
    session.clear()
    return redirect('/login')


# ---------------- RUN ----------------
if __name__ == '__main__':
    app.run(debug=True)