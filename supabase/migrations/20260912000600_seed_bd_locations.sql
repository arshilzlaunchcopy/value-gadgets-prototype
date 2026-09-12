-- 20260912000600_seed_bd_locations.sql
-- Bangladesh geography: 8 divisions + 64 districts. Idempotent.
-- Upazilas (~495) are deferred to a later migration.

-- Divisions ----------------------------------------------------------------
insert into public.bd_locations (level, parent_id, name_en, name_bn, slug, position) values
  ('division', null, 'Dhaka',       'ঢাকা',       'dhaka',       1),
  ('division', null, 'Chattogram',  'চট্টগ্রাম',   'chattogram',  2),
  ('division', null, 'Rajshahi',    'রাজশাহী',    'rajshahi',    3),
  ('division', null, 'Khulna',      'খুলনা',      'khulna',      4),
  ('division', null, 'Barishal',    'বরিশাল',     'barishal',    5),
  ('division', null, 'Sylhet',      'সিলেট',      'sylhet',      6),
  ('division', null, 'Rangpur',     'রংপুর',      'rangpur',     7),
  ('division', null, 'Mymensingh',  'ময়মনসিংহ',   'mymensingh',  8)
on conflict (level, slug) do update
  set name_en = excluded.name_en, name_bn = excluded.name_bn, position = excluded.position;

-- Districts ----------------------------------------------------------------
with d(division_slug, name_en, name_bn, slug, position) as (
  values
  -- Dhaka (13)
  ('dhaka', 'Dhaka',          'ঢাকা',           'dhaka',          1),
  ('dhaka', 'Gazipur',        'গাজীপুর',         'gazipur',        2),
  ('dhaka', 'Narayanganj',    'নারায়ণগঞ্জ',      'narayanganj',    3),
  ('dhaka', 'Tangail',        'টাঙ্গাইল',        'tangail',        4),
  ('dhaka', 'Kishoreganj',    'কিশোরগঞ্জ',       'kishoreganj',    5),
  ('dhaka', 'Manikganj',      'মানিকগঞ্জ',       'manikganj',      6),
  ('dhaka', 'Munshiganj',     'মুন্সীগঞ্জ',       'munshiganj',     7),
  ('dhaka', 'Narsingdi',      'নরসিংদী',         'narsingdi',      8),
  ('dhaka', 'Faridpur',       'ফরিদপুর',         'faridpur',       9),
  ('dhaka', 'Gopalganj',      'গোপালগঞ্জ',       'gopalganj',      10),
  ('dhaka', 'Madaripur',      'মাদারীপুর',       'madaripur',      11),
  ('dhaka', 'Rajbari',        'রাজবাড়ী',        'rajbari',        12),
  ('dhaka', 'Shariatpur',     'শরীয়তপুর',        'shariatpur',     13),
  -- Chattogram (11)
  ('chattogram', 'Chattogram',     'চট্টগ্রাম',       'chattogram',     1),
  ('chattogram', 'Cox''s Bazar',   'কক্সবাজার',       'coxs-bazar',     2),
  ('chattogram', 'Cumilla',        'কুমিল্লা',        'cumilla',        3),
  ('chattogram', 'Feni',           'ফেনী',           'feni',           4),
  ('chattogram', 'Brahmanbaria',   'ব্রাহ্মণবাড়িয়া',   'brahmanbaria',   5),
  ('chattogram', 'Rangamati',      'রাঙ্গামাটি',      'rangamati',      6),
  ('chattogram', 'Noakhali',       'নোয়াখালী',       'noakhali',       7),
  ('chattogram', 'Chandpur',       'চাঁদপুর',         'chandpur',       8),
  ('chattogram', 'Lakshmipur',     'লক্ষ্মীপুর',       'lakshmipur',     9),
  ('chattogram', 'Khagrachhari',   'খাগড়াছড়ি',       'khagrachhari',   10),
  ('chattogram', 'Bandarban',      'বান্দরবান',       'bandarban',      11),
  -- Rajshahi (8)
  ('rajshahi', 'Rajshahi',         'রাজশাহী',        'rajshahi',       1),
  ('rajshahi', 'Bogura',           'বগুড়া',          'bogura',         2),
  ('rajshahi', 'Pabna',            'পাবনা',          'pabna',          3),
  ('rajshahi', 'Sirajganj',        'সিরাজগঞ্জ',       'sirajganj',      4),
  ('rajshahi', 'Natore',           'নাটোর',          'natore',         5),
  ('rajshahi', 'Naogaon',          'নওগাঁ',          'naogaon',        6),
  ('rajshahi', 'Chapainawabganj',  'চাঁপাইনবাবগঞ্জ',   'chapainawabganj',7),
  ('rajshahi', 'Joypurhat',        'জয়পুরহাট',       'joypurhat',      8),
  -- Khulna (10)
  ('khulna', 'Khulna',             'খুলনা',          'khulna',         1),
  ('khulna', 'Jashore',            'যশোর',           'jashore',        2),
  ('khulna', 'Satkhira',           'সাতক্ষীরা',       'satkhira',       3),
  ('khulna', 'Bagerhat',           'বাগেরহাট',        'bagerhat',       4),
  ('khulna', 'Jhenaidah',          'ঝিনাইদহ',        'jhenaidah',      5),
  ('khulna', 'Magura',             'মাগুরা',         'magura',         6),
  ('khulna', 'Narail',             'নড়াইল',          'narail',         7),
  ('khulna', 'Kushtia',            'কুষ্টিয়া',        'kushtia',        8),
  ('khulna', 'Chuadanga',          'চুয়াডাঙ্গা',       'chuadanga',      9),
  ('khulna', 'Meherpur',           'মেহেরপুর',        'meherpur',       10),
  -- Barishal (6)
  ('barishal', 'Barishal',         'বরিশাল',         'barishal',       1),
  ('barishal', 'Patuakhali',       'পটুয়াখালী',       'patuakhali',     2),
  ('barishal', 'Bhola',            'ভোলা',           'bhola',          3),
  ('barishal', 'Pirojpur',         'পিরোজপুর',        'pirojpur',       4),
  ('barishal', 'Jhalokathi',       'ঝালকাঠি',        'jhalokathi',     5),
  ('barishal', 'Barguna',          'বরগুনা',         'barguna',        6),
  -- Sylhet (4)
  ('sylhet', 'Sylhet',             'সিলেট',          'sylhet',         1),
  ('sylhet', 'Moulvibazar',        'মৌলভীবাজার',      'moulvibazar',    2),
  ('sylhet', 'Habiganj',           'হবিগঞ্জ',         'habiganj',       3),
  ('sylhet', 'Sunamganj',          'সুনামগঞ্জ',       'sunamganj',      4),
  -- Rangpur (8)
  ('rangpur', 'Rangpur',           'রংপুর',          'rangpur',        1),
  ('rangpur', 'Dinajpur',          'দিনাজপুর',        'dinajpur',       2),
  ('rangpur', 'Gaibandha',         'গাইবান্ধা',       'gaibandha',      3),
  ('rangpur', 'Kurigram',          'কুড়িগ্রাম',       'kurigram',       4),
  ('rangpur', 'Lalmonirhat',       'লালমনিরহাট',      'lalmonirhat',    5),
  ('rangpur', 'Nilphamari',        'নীলফামারী',       'nilphamari',     6),
  ('rangpur', 'Panchagarh',        'পঞ্চগড়',         'panchagarh',     7),
  ('rangpur', 'Thakurgaon',        'ঠাকুরগাঁও',       'thakurgaon',     8),
  -- Mymensingh (4)
  ('mymensingh', 'Mymensingh',     'ময়মনসিংহ',       'mymensingh',     1),
  ('mymensingh', 'Jamalpur',       'জামালপুর',        'jamalpur',       2),
  ('mymensingh', 'Netrokona',      'নেত্রকোণা',       'netrokona',      3),
  ('mymensingh', 'Sherpur',        'শেরপুর',         'sherpur',        4)
)
insert into public.bd_locations (level, parent_id, name_en, name_bn, slug, position)
select 'district', div.id, d.name_en, d.name_bn, d.slug, d.position
from d
join public.bd_locations div on div.level = 'division' and div.slug = d.division_slug
on conflict (level, slug) do update
  set parent_id = excluded.parent_id,
      name_en   = excluded.name_en,
      name_bn   = excluded.name_bn,
      position  = excluded.position;
