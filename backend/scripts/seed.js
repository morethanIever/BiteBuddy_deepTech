require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { db, initPromise, initSchema } = require('../src/db');
const { computeScore } = require('../src/lib/scoring');

initPromise.then(() => {
  initSchema();

  console.log('🌱 Seeding...');

  // Clear
  db.exec(`
    DELETE FROM scans;
    DELETE FROM restaurants;
    DELETE FROM device_keys;
    DELETE FROM applications;
  `);

  const RESTAURANTS = [
    { name: 'Nasi Kandar Pelita', type: 'Indian Muslim', area: 'Ampang', address: 'Jalan Ampang, KL', lat: 3.1573, lng: 101.7187 },
    { name: 'Village Park Nasi Lemak', type: 'Malaysian', area: 'Damansara', address: 'Jalan SS21/1, Damansara', lat: 3.1319, lng: 101.6232 },
    { name: 'Jalan Alor Hawker Street', type: 'Street Food', area: 'Bukit Bintang', address: 'Jalan Alor, KL', lat: 3.1464, lng: 101.7117 },
    { name: 'Atmosphere 360 Restaurant', type: 'International', area: 'KL Tower', address: 'Menara KL, Bukit Nanas', lat: 3.1529, lng: 101.7037 },
    { name: 'Old Town White Coffee', type: 'Malaysian Café', area: 'Pavilion', address: 'Pavilion KL, Bukit Bintang', lat: 3.1488, lng: 101.7131 },
    { name: "Madam Kwan's KLCC", type: 'Malaysian', area: 'KLCC', address: 'Suria KLCC, Jalan Ampang', lat: 3.1578, lng: 101.7123 },
    { name: "Raj's Banana Leaf", type: 'South Indian', area: 'Brickfields', address: 'Jalan Scott, Brickfields', lat: 3.1297, lng: 101.6866 },
    { name: 'Hawker Stall Sg. Wang', type: 'Street Food', area: 'Bukit Bintang', address: 'Sungei Wang Plaza', lat: 3.1468, lng: 101.7109 },
    { name: 'Warung Pak Abu Nasi Lemak', type: 'Malaysian', area: 'Chow Kit', address: 'Jalan Tuanku Abdul Halim', lat: 3.1697, lng: 101.6978 },
    { name: 'Din Tai Fung KLCC', type: 'Taiwanese', area: 'KLCC', address: 'Suria KLCC Level 4', lat: 3.1582, lng: 101.7118 },
    { name: 'Songket Restaurant', type: 'Malaysian Fine', area: 'Sri Hartamas', address: 'Sri Hartamas Shopping Centre', lat: 3.1650, lng: 101.6481 },
    { name: 'Peter Hoe Beyond', type: 'Fusion', area: 'Chinatown', address: 'Lee Rubber Building, Jalan TAR', lat: 3.1453, lng: 101.6974 },
    { name: 'Kedai Kopi Yut Kee', type: 'Malaysian-Chinese', area: 'Dang Wangi', address: 'Jalan Kamunting, KL', lat: 3.1553, lng: 101.7012 },
    { name: 'Rebung Chef Ismail', type: 'Malaysian', area: 'Bangsar', address: 'Jalan Bangsar, KL', lat: 3.1214, lng: 101.6748 },
    { name: 'Overseas Restaurant', type: 'Cantonese', area: 'Jalan Imbi', address: 'Jalan Imbi, Bukit Bintang', lat: 3.1460, lng: 101.7143 },
    { name: 'Sushi King Pavilion', type: 'Japanese', area: 'Pavilion', address: 'Pavilion KL Level 3', lat: 3.1491, lng: 101.7135 },
    { name: 'Food Republic NU Sentral', type: 'Food Court', area: 'KL Sentral', address: 'NU Sentral Shopping Mall', lat: 3.1341, lng: 101.6872 },
    { name: 'Limapulo Brasserie', type: 'Malaysian', area: 'KLCC', address: 'Jalan P. Ramlee, KL', lat: 3.1596, lng: 101.7074 },
    { name: 'Zeng Dim Sum Stadium', type: 'Dim Sum', area: 'Chow Kit', address: 'Jalan Stadium, KL', lat: 3.1673, lng: 101.6928 },
    { name: "Nathalie's Gourmet", type: 'European', area: 'KLCC', address: 'Menara Keck Seng', lat: 3.1524, lng: 101.7165 },
  ];

  const PRESETS = ['safe','safe','warning','safe','safe','safe','safe','danger','safe','safe','safe','safe','safe','warning','safe','safe','warning','safe','safe','safe'];
  const bacteriaMap = {
    safe:    { salmonella: 'ND', ecoli: 'ND', staph: 'ND' },
    warning: { salmonella: 'Trace', ecoli: 'ND', staph: 'ND' },
    danger:  { salmonella: 'Detected', ecoli: 'ND', staph: 'Trace' },
  };

  const now = Date.now();

  RESTAURANTS.forEach((rest, i) => {
    const preset = PRESETS[i];
    const readings = bacteriaMap[preset];
    const { score, result } = computeScore(readings);
    const hoursAgo = Math.floor(Math.random() * 6) + 1;
    const scanTime = new Date(now - hoursAgo * 3600000).toISOString();

    const r = db.prepare(`
      INSERT INTO restaurants (name,type,area,address,lat,lng,status,score,verified_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(rest.name, rest.type, rest.area, rest.address, rest.lat, rest.lng, result, score, scanTime);

    // Insert scan history
    [3, 2, 1].forEach(day => {
      const dayReadings = day === 1 ? readings : bacteriaMap.safe;
      const { score: ds, result: dr } = computeScore(dayReadings);
      db.prepare(`
        INSERT INTO scans (restaurant_id,device_key,salmonella,ecoli,staph,result,score,created_at)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(r.lastInsertRowid, `dev-${i+1}`, dayReadings.salmonella, dayReadings.ecoli, dayReadings.staph, dr, ds, new Date(now - day*86400000).toISOString());
    });
  });

  // Device keys
  db.prepare('INSERT INTO device_keys (key_value,label,restaurant_id) VALUES (?,?,?)').run('BB-DEV-001-ALPHA','Demo Device Alpha',1);
  db.prepare('INSERT INTO device_keys (key_value,label,restaurant_id) VALUES (?,?,?)').run('BB-DEV-002-BETA','Demo Device Beta',2);
  db.prepare('INSERT INTO device_keys (key_value,label,restaurant_id) VALUES (?,?,?)').run('BB-DEV-003-TEST','Test Device',null);

  // Applications
  db.prepare('INSERT INTO applications (restaurant_name,cuisine_type,area,contact_email) VALUES (?,?,?,?)').run("Mama Chow's Kitchen",'Fusion','Mont Kiara','mamachow@gmail.com');
  db.prepare('INSERT INTO applications (restaurant_name,cuisine_type,area,contact_email) VALUES (?,?,?,?)').run('Ali Maju Nasi Lemak','Malaysian','Bangsar','alimaju@outlook.com');

  console.log(`✅ Seeded ${RESTAURANTS.length} restaurants`);
  console.log(`✅ Device keys: BB-DEV-001-ALPHA, BB-DEV-002-BETA, BB-DEV-003-TEST`);
  console.log(`\n🔑 Admin: ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASSWORD}`);

  setTimeout(() => process.exit(0), 3000);
}).catch(err => { console.error(err); process.exit(1); });
