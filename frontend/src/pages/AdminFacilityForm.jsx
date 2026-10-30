// =============================================================
// frontend/src/pages/AdminFacilityForm.jsx  —  /admin/facilities/new  ("Add / Edit Facility")
// =============================================================
// Opened from Facilities Status -> "+ Add new sport". Saves with POST /admin/facilities,
// then returns to the Facilities Status page.
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiCall } from '../utils/api';

const SPORTS = ['Football', 'Basketball', 'Volleyball', 'Badminton', 'Table Tennis', 'Archery'];

// Shrink the chosen photo in the browser (max 1200px wide, JPEG) so it is small enough to store.
const MAX_FILE_MB = 5;
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1200 / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      for (const quality of [0.8, 0.7, 0.6, 0.5]) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length <= 650000) return resolve(dataUrl);
      }
      reject(new Error('That photo is too detailed to store. Try a smaller picture.'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a readable picture.')); };
    img.src = url;
  });
}

const EMPTY_FORM = {
  name: '', type: '', group_name: '', court_label: '', capacity: '', location: 'Main Campus',
  max_duration_minutes: 60, image_url: '', description: '', role: 'everyone',
  weekday_start: '16:00', weekday_end: '22:00', weekend_start: '08:00', weekend_end: '22:00',
  is_active: true,
};

export default function AdminFacilityForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [imageNote, setImageNote] = useState('');
  const fileInput = useRef(null);

  const field = (name) => (e) => setForm({ ...form, [name]: e.target.value });

  async function chooseFile(file) {
    setImageNote('');
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setImageNote('Please choose a JPG, PNG or WEBP picture.');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setImageNote(`That picture is over ${MAX_FILE_MB} MB.`);
      return;
    }
    try {
      const dataUrl = await compressImage(file);
      setForm((f) => ({ ...f, image_url: dataUrl }));
    } catch (e) {
      setImageNote(e.message);
    }
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { weekday_start, weekday_end, weekend_start, weekend_end, ...rest } = form;
      await apiCall('/admin/facilities', 'POST', {
        ...rest,
        max_duration_minutes: Number(form.max_duration_minutes),
        hours: { weekday_start, weekday_end, weekend_start, weekend_end },
      });
      navigate('/admin/facilities', {
        state: { message: `${form.name.trim()} was added${form.is_active ? ' and is now open for booking' : ' (marked unavailable)'}.` },
      });
    } catch (e) {
      setError(e.message);
      setSaving(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <form className="ud-page" onSubmit={save}>
      <Link to="/admin/facilities" className="usr-back">← Back to Facilities Status</Link>

      <header className="ud-head">
        <div>
          <h1>Add / Edit Facility</h1>
          <p>Register a new sports venue or update its operational details.</p>
        </div>
        <button type="submit" className="ud-save" disabled={saving}>{saving ? 'Saving…' : 'Save Facility'}</button>
      </header>

      {error && <div className="error" role="alert">{error}</div>}

      <section className="ud-card">
        <h2>Facility Information</h2>
        <div className="ud-grid">
          <label>Facility Name
            <input required maxLength="50" value={form.name} onChange={field('name')} placeholder="e.g. Squash Court 1" />
          </label>
          <label>Facility Type
            <input required list="fm-sports" maxLength="50" value={form.type} onChange={field('type')} placeholder="e.g. Squash" />
            <datalist id="fm-sports">{SPORTS.map((t) => <option key={t} value={t} />)}</datalist>
          </label>
          <label className="ud-wide">Description
            <textarea maxLength="600" rows="3" value={form.description} onChange={field('description')}
              placeholder="Indoor court with competition-grade flooring and evening lighting." />
          </label>
          <label>Weekday Opening Time (Mon–Fri)
            <input required type="time" value={form.weekday_start} onChange={field('weekday_start')} />
          </label>
          <label>Weekday Closing Time
            <input required type="time" value={form.weekday_end} onChange={field('weekday_end')} />
          </label>
          <label>Weekend Opening Time (Sat–Sun)
            <input required type="time" value={form.weekend_start} onChange={field('weekend_start')} />
          </label>
          <label>Weekend Closing Time
            <input required type="time" value={form.weekend_end} onChange={field('weekend_end')} />
          </label>
          <label>Location
            <input maxLength="100" value={form.location} onChange={field('location')} />
          </label>
          <label>Capacity
            <input type="number" min="1" value={form.capacity} onChange={field('capacity')} placeholder="e.g. 24 people" />
          </label>
          <label>Longest Booking (minutes)
            <input required type="number" min="15" max="480" step="15" value={form.max_duration_minutes} onChange={field('max_duration_minutes')} />
          </label>
          <label>Who Can Book
            <select value={form.role} onChange={field('role')}>
              <option value="everyone">Everyone (students, staff, public)</option>
              <option value="student">Students only</option>
            </select>
          </label>
          <label>Group Name (optional)
            <input maxLength="50" value={form.group_name} onChange={field('group_name')} placeholder="Defaults to the facility name" />
          </label>
          <label>Court Label (optional)
            <input maxLength="50" value={form.court_label} onChange={field('court_label')} placeholder="e.g. 1" />
          </label>
        </div>
        <p className="ud-hint">To add a second court of an existing sport, reuse the same Group Name (for example &ldquo;Badminton Court&rdquo;) and give it a Court Label.</p>
      </section>

      <section className="ud-card">
        <h2>Facility Image</h2>
        <div
          className="fm-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); chooseFile(e.dataTransfer.files?.[0]); }}
        >
          {form.image_url ? (
            <img src={form.image_url} alt="Facility preview" />
          ) : (
            <div className="fm-drop-empty" aria-hidden="true">No image yet</div>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => { chooseFile(e.target.files?.[0]); e.target.value = ''; }}
          />
          <button type="button" className="fm-upload-link" onClick={() => fileInput.current?.click()}>
            {form.image_url ? 'Change facility image' : 'Upload facility image'}
          </button>
          <small>PNG, JPG or WEBP, up to {MAX_FILE_MB} MB. You can also drag a picture here.</small>
          {form.image_url && (
            <button type="button" className="fm-remove" onClick={() => setForm({ ...form, image_url: '' })}>Remove image</button>
          )}
          {imageNote && <small className="fm-warn" role="alert">{imageNote}</small>}
        </div>
      </section>

      <section className="ud-card">
        <h2>Availability Status</h2>
        <p className="ud-hint fm-lead">Choose how this facility appears in booking search.</p>
        <div className="fm-radios" role="radiogroup" aria-label="Availability status">
          <label className={`fm-radio ${form.is_active ? 'on' : ''}`}>
            <input type="radio" name="availability" checked={form.is_active} onChange={() => setForm({ ...form, is_active: true })} />
            <span className="fm-dot" aria-hidden="true" />
            <span><strong>Active</strong><small>Available for bookings</small></span>
          </label>
          <label className={`fm-radio ${!form.is_active ? 'on' : ''}`}>
            <input type="radio" name="availability" checked={!form.is_active} onChange={() => setForm({ ...form, is_active: false })} />
            <span className="fm-dot" aria-hidden="true" />
            <span><strong>Maintenance</strong><small>Temporarily unavailable</small></span>
          </label>
        </div>
      </section>
    </form>
  );
}
