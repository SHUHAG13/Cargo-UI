import { Doctor, Specialty } from '../models';

/**
 * Demo catalogue for Doctor Consultation. Doctors do not change at run time, so they live here rather than in the store;
 * only consultations are persisted. Every doctor except Dr. Shibly Shahriar is fictional, with an illustrated demo portrait.
 */

export const SPECIALTIES: Specialty[] = [
  { id: 'general', name: 'General Physician', blurb: 'Fever, cold, flu & everyday care', icon: 'fa-user-doctor' },
  { id: 'medicine', name: 'Internal Medicine', blurb: 'General health & medicine', icon: 'fa-stethoscope' },
  { id: 'pediatrics', name: 'Pediatrics', blurb: 'Child health care', icon: 'fa-baby' },
  { id: 'gynae', name: 'Gynae & Obs', blurb: "Women's health & pregnancy", icon: 'fa-person-pregnant' },
  { id: 'dermatology', name: 'Dermatology', blurb: 'Skin, hair & nails', icon: 'fa-hand-dots' },
  { id: 'cardiology', name: 'Cardiology', blurb: 'Heart & blood pressure', icon: 'fa-heart-pulse' },
  { id: 'chest', name: 'Chest & Thoracic', blurb: 'Lungs, breathing & chest surgery', icon: 'fa-lungs' },
  { id: 'psychiatry', name: 'Psychiatry', blurb: 'Mental & emotional health', icon: 'fa-brain' },
  { id: 'orthopedics', name: 'Orthopedics', blurb: 'Bone, muscle & joint care', icon: 'fa-bone' },
  { id: 'endocrinology', name: 'Endocrinology', blurb: 'Diabetes, thyroid & hormones', icon: 'fa-droplet' },
  { id: 'nutrition', name: 'Food & Nutrition', blurb: 'Diet charts & weight care', icon: 'fa-apple-whole' },
];

/** 24/7 instant video consultations at a flat price; the first online doctor of the specialty takes the call. */
export const INSTANT_OFFERS = [
  { id: 'mbbs', title: 'Experienced MBBS Doctor', specialtyId: 'general', price: 149, icon: 'fa-user-doctor' },
  { id: 'child', title: 'Experienced Child Doctor', specialtyId: 'pediatrics', price: 249, icon: 'fa-baby' },
  { id: 'gynae', title: 'Female Gynae Doctor', specialtyId: 'gynae', price: 249, icon: 'fa-person-pregnant' },
  { id: 'skin', title: 'Skin Disease Specialist', specialtyId: 'dermatology', price: 399, icon: 'fa-hand-dots' },
];
export type InstantOffer = (typeof INSTANT_OFFERS)[number];

/** "Common health concerns" shortcuts: each one opens the matching specialty. */
export const CONCERNS: { label: string; specialtyId: string }[] = [
  { label: 'Fever, cold, flu & allergy', specialtyId: 'general' },
  { label: 'Child diseases', specialtyId: 'pediatrics' },
  { label: 'Pregnancy & period problems', specialtyId: 'gynae' },
  { label: 'Itching, acne & skin problems', specialtyId: 'dermatology' },
  { label: 'Hair fall & dandruff', specialtyId: 'dermatology' },
  { label: 'Cough & breathing difficulty', specialtyId: 'chest' },
  { label: 'Chest pain & high blood pressure', specialtyId: 'cardiology' },
  { label: 'Diabetes & thyroid', specialtyId: 'endocrinology' },
  { label: 'Acidity, indigestion & diarrhoea', specialtyId: 'medicine' },
  { label: 'Back & joint pain', specialtyId: 'orthopedics' },
  { label: 'Anxiety, stress & sleep', specialtyId: 'psychiatry' },
  { label: 'Weight loss/gain & diet chart', specialtyId: 'nutrition' },
];

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const SAT_TO_THU = [0, 1, 2, 3, 4, 6];

export const DOCTORS: Doctor[] = [
  {
    id: 'DOC-06', name: 'Dr. Shibly Shahriar', gender: 'Male', photo: 'assets/img/doctors/dr-shibly-shahriar.jpg',
    degrees: ['MBBS', 'BCS (Health)', 'MS Surgical Resident (Thoracic Surgery)'],
    specialtyId: 'chest', designation: 'Thoracic Surgery Resident', workplace: 'National Institute of Diseases of the Chest & Hospital (NIDCH), Mohakhali, Dhaka',
    headline: 'Thoracic Surgery Resident at NIDCH || Government Healthcare Professional || Medical Volunteer Leader || Public Health Advocate || Committed to Advancing Healthcare in Bangladesh.',
    experienceYears: 6, rating: 4.9, reviews: 212, visits: 860, languages: ['Bangla', 'English'],
    about: 'MS Surgical Resident in Thoracic Surgery at the National Institute of Diseases of the Chest & Hospital (NIDCH), Mohakhali, and a government healthcare professional. Medical volunteer leader and public health advocate, committed to advancing healthcare in Bangladesh. Consults on chest and lung conditions, persistent cough, breathing difficulty, chest injuries and advice before or after chest surgery.',
    fee: 600, listFee: 800, followUpFee: 0, followUpDays: 14, modes: ['video'], online: true, featured: true,
    video: { days: EVERY_DAY, start: '20:00', end: '22:00', slotMins: 20 },
  },
  {
    id: 'DOC-01', name: 'Dr. Kamrul Hasan', gender: 'Male', photo: 'assets/img/doctors/dr-kamrul-hasan.svg', degrees: ['MBBS', 'CCD (BIRDEM)'], specialtyId: 'general', designation: 'General Physician',
    workplace: 'CareGo+ Telemedicine Desk, Dhaka', experienceYears: 9, rating: 4.8, reviews: 1840, visits: 6120, bmdc: 'A-71204', languages: ['Bangla', 'English'],
    about: 'Primary-care physician for fever, cold and flu, gastric problems, blood pressure and diabetes follow-up. Available for instant video consultations most of the day.',
    fee: 300, followUpFee: 0, followUpDays: 7, modes: ['video'], online: true,
    video: { days: EVERY_DAY, start: '09:00', end: '23:00', slotMins: 15 },
  },
  {
    id: 'DOC-12', name: 'Dr. Rumana Akter', gender: 'Female', photo: 'assets/img/doctors/dr-rumana-akter.svg', degrees: ['MBBS', 'PGT (Medicine)'], specialtyId: 'general', designation: 'General Physician',
    workplace: 'CareGo+ Telemedicine Desk, Dhaka', experienceYears: 5, rating: 4.7, reviews: 690, visits: 2310, bmdc: 'A-88231', languages: ['Bangla', 'English'],
    about: 'General physician with a special interest in women’s everyday health, seasonal illness and lifestyle advice.',
    fee: 250, followUpFee: 0, followUpDays: 7, modes: ['video'], online: true,
    video: { days: EVERY_DAY, start: '08:00', end: '20:00', slotMins: 15 },
  },
  {
    id: 'DOC-02', name: 'Dr. Nusrat Jahan', gender: 'Female', photo: 'assets/img/doctors/dr-nusrat-jahan.svg', degrees: ['MBBS', 'MCPS (Gynae & Obs)', 'FCPS (Gynae & Obs)'], specialtyId: 'gynae',
    designation: 'Gynecologist & Obstetrician', workplace: 'Dhaka Medical College Hospital', experienceYears: 14, rating: 4.9, reviews: 960, visits: 3420,
    bmdc: 'A-52190', languages: ['Bangla', 'English'],
    about: 'Antenatal and postnatal care, irregular periods, PCOS, infertility counselling and menopause care.',
    fee: 800, listFee: 1000, followUpFee: 300, followUpDays: 14, modes: ['video', 'chamber'], online: true,
    video: { days: SAT_TO_THU, start: '18:00', end: '21:00', slotMins: 20 },
    chamber: { days: [5, 6], start: '10:00', end: '13:00', slotMins: 20, name: 'CareGo+ Clinic, Dhanmondi', address: 'House 27, Road 7, Dhanmondi, Dhaka-1205' },
  },
  {
    id: 'DOC-03', title: 'Asst. Prof.', name: 'Dr. Farzana Haque', gender: 'Female', photo: 'assets/img/doctors/dr-farzana-haque.svg', degrees: ['MBBS', 'FCPS (Paediatrics)'], specialtyId: 'pediatrics',
    designation: 'Child Specialist', workplace: 'Dhaka Shishu (Children) Hospital', experienceYears: 16, rating: 4.9, reviews: 1210, visits: 4380,
    bmdc: 'A-48817', languages: ['Bangla', 'English'],
    about: 'Newborn care, child fever and infections, vaccination advice, growth and feeding problems.',
    fee: 700, followUpFee: 0, followUpDays: 10, modes: ['video'], online: true,
    video: { days: EVERY_DAY, start: '10:00', end: '22:00', slotMins: 20 },
  },
  {
    id: 'DOC-04', name: 'Dr. Sabrina Chowdhury', gender: 'Female', photo: 'assets/img/doctors/dr-sabrina-chowdhury.svg', degrees: ['MBBS', 'DDV (Dermatology)'], specialtyId: 'dermatology',
    designation: 'Dermatologist', workplace: 'CareGo+ Clinic, Gulshan', experienceYears: 9, rating: 4.8, reviews: 2230, visits: 7940,
    bmdc: 'A-69342', languages: ['Bangla', 'English'],
    about: 'Acne, eczema, fungal infections, hair fall, pigmentation and allergic skin conditions.',
    fee: 500, followUpFee: 0, followUpDays: 7, modes: ['video', 'chamber'], online: true,
    video: { days: EVERY_DAY, start: '11:00', end: '22:00', slotMins: 15 },
    chamber: { days: [1, 3], start: '17:00', end: '20:00', slotMins: 15, name: 'CareGo+ Clinic, Gulshan', address: 'Road 90, Gulshan-2, Dhaka-1212' },
  },
  {
    id: 'DOC-05', title: 'Prof.', name: 'Dr. Rezaul Karim', gender: 'Male', photo: 'assets/img/doctors/dr-rezaul-karim.svg', degrees: ['MBBS', 'MD (Cardiology)', 'FACC'], specialtyId: 'cardiology',
    designation: 'Cardiologist', workplace: 'National Institute of Cardiovascular Diseases, Dhaka', experienceYears: 24, rating: 4.9, reviews: 780, visits: 2650,
    bmdc: 'A-21456', languages: ['Bangla', 'English'],
    about: 'Chest pain, high blood pressure, heart failure, irregular heartbeat and care after heart attack or stenting.',
    fee: 1200, followUpFee: 600, followUpDays: 15, modes: ['video', 'chamber'], online: false,
    video: { days: SAT_TO_THU, start: '19:00', end: '21:00', slotMins: 20 },
    chamber: { days: [6, 1, 3], start: '16:00', end: '19:00', slotMins: 20, name: 'CareGo+ Heart Clinic, Mohakhali', address: 'Mohakhali C/A, Dhaka-1212' },
  },
  {
    id: 'DOC-07', name: 'Dr. Ayesha Siddiqua', gender: 'Female', photo: 'assets/img/doctors/dr-ayesha-siddiqua.svg', degrees: ['MBBS', 'FCPS (Psychiatry)'], specialtyId: 'psychiatry',
    designation: 'Psychiatrist', workplace: 'National Institute of Mental Health, Dhaka', experienceYears: 12, rating: 4.9, reviews: 410, visits: 1520,
    bmdc: 'A-60318', languages: ['Bangla', 'English'],
    about: 'Anxiety, depression, sleep problems, stress, OCD and addiction. Sessions are private and unhurried.',
    fee: 1000, followUpFee: 500, followUpDays: 14, modes: ['video'], online: false,
    video: { days: SAT_TO_THU, start: '17:00', end: '21:00', slotMins: 30 },
  },
  {
    id: 'DOC-08', title: 'Asst. Prof.', name: 'Dr. Mahmudul Hasan', gender: 'Male', photo: 'assets/img/doctors/dr-mahmudul-hasan.svg', degrees: ['MBBS', 'MS (Orthopaedics)'], specialtyId: 'orthopedics',
    designation: 'Orthopedic Surgeon', workplace: 'National Institute of Traumatology & Orthopaedic Rehabilitation (NITOR)', experienceYears: 13, rating: 4.8, reviews: 640, visits: 1890,
    bmdc: 'A-55702', languages: ['Bangla', 'English'],
    about: 'Back and neck pain, arthritis, sports injuries, fractures and rehabilitation advice for elderly patients.',
    fee: 600, followUpFee: 0, followUpDays: 10, modes: ['video', 'chamber'], online: false,
    video: { days: EVERY_DAY, start: '18:00', end: '21:00', slotMins: 20 },
    chamber: { days: [4, 6], start: '10:00', end: '12:00', slotMins: 20, name: 'CareGo+ Clinic, Dhanmondi', address: 'House 27, Road 7, Dhanmondi, Dhaka-1205' },
  },
  {
    id: 'DOC-10', name: 'Dr. Imran Hossain', gender: 'Male', photo: 'assets/img/doctors/dr-imran-hossain.svg', degrees: ['MBBS', 'MD (Endocrinology)'], specialtyId: 'endocrinology',
    designation: 'Endocrinologist', workplace: 'BIRDEM General Hospital, Dhaka', experienceYears: 11, rating: 4.8, reviews: 350, visits: 1180,
    bmdc: 'A-63925', languages: ['Bangla', 'English'],
    about: 'Diabetes control and insulin plans, thyroid disorders, obesity and hormonal problems.',
    fee: 800, followUpFee: 300, followUpDays: 14, modes: ['video'], online: false,
    video: { days: EVERY_DAY, start: '16:00', end: '20:00', slotMins: 20 },
  },
  {
    id: 'DOC-11', name: 'Dr. Tanvir Ahmed', gender: 'Male', photo: 'assets/img/doctors/dr-tanvir-ahmed.svg', degrees: ['MBBS', 'BCS (Health)', 'FCPS (Medicine)'], specialtyId: 'medicine',
    designation: 'Medicine Specialist', workplace: 'Shaheed Suhrawardy Medical College Hospital, Dhaka', experienceYears: 15, rating: 4.8, reviews: 1020, visits: 3870,
    bmdc: 'A-50461', languages: ['Bangla', 'English'],
    about: 'Gastric and liver problems, fever of unknown cause, hypertension and elderly multi-disease care.',
    fee: 700, followUpFee: 0, followUpDays: 10, modes: ['video', 'chamber'], online: true,
    video: { days: EVERY_DAY, start: '15:00', end: '22:00', slotMins: 20 },
    chamber: { days: [0, 2], start: '18:00', end: '21:00', slotMins: 20, name: 'CareGo+ Clinic, Uttara', address: 'Sector 7, Uttara, Dhaka-1230' },
  },
  {
    id: 'DOC-09', name: 'Tasnim Ferdous', gender: 'Female', photo: 'assets/img/doctors/tasnim-ferdous.svg', degrees: ['BSc (Food & Nutrition)', 'MSc (Food & Nutrition)'], specialtyId: 'nutrition',
    designation: 'Nutritionist', workplace: 'CareGo+ Wellness Desk', experienceYears: 8, rating: 4.9, reviews: 1460, visits: 4210,
    languages: ['Bangla', 'English'],
    about: 'Personal diet charts for weight loss or gain, diabetes, pregnancy and elderly nutrition.',
    fee: 450, followUpFee: 0, followUpDays: 14, modes: ['video'], online: true,
    video: { days: EVERY_DAY, start: '10:00', end: '20:00', slotMins: 30 },
  },
];

export const FEATURED_DOCTOR = DOCTORS.find((d) => d.featured);
