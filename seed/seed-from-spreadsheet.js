#!/usr/bin/env node

/**
 * Seed DynamoDB with volunteer data extracted from the IMC Palatine parking
 * volunteer spreadsheets. All data is hardcoded so no xlsx dependency is needed.
 *
 * Usage:
 *   node seed/seed-from-spreadsheet.js
 *
 * Requires: AWS credentials configured, DynamoDB table already created (npm run setup-db).
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const db = require(path.join(__dirname, '..', 'functions', 'shared', 'db'));

/* ================================================================
   ORGANIZATION
   ================================================================ */
const ORG_ID = process.env.ORG_ID || uuidv4();
const ORG_NAME = 'IMC Palatine';

/* ================================================================
   LOCATIONS
   ================================================================ */
const LOCATIONS = [
  { name: 'Ukie Community Center (Clearbrook)' },
  { name: 'Mosque Front' },
  { name: 'Mosque Back' },
  { name: 'Palatine Police Station / Public Works' },
  { name: 'Hicks and Illinois' },
  { name: 'Illinois and Plumb Grove Shopping Center' },
  { name: 'CYM' },
  { name: 'IMC Church' },
  { name: 'CYM Soccer Field' },
];

/* ================================================================
   EVENTS
   ================================================================ */
const EVENTS = [
  { name: 'Palm/Willow Sunday',                                          date: '2026-03-29' },
  { name: 'Holy Saturday (Gregorian) Basket Blessing',                   date: '2026-04-04' },
  { name: 'Gregorian Easter / Julian Willow Sunday',                     date: '2026-04-05' },
  { name: 'Holy Saturday (Julian) Basket Blessing',                      date: '2026-04-11' },
  { name: 'Julian Easter / Divine Mercy / St. Thomas Sunday',            date: '2026-04-12' },
];

/* ================================================================
   SHIFTS PER EVENT (keyed by event date)
   ================================================================ */
const SHIFTS_BY_DATE = {
  '2026-03-29': [
    { label: '7:00 AM - 10:00 AM',  startTime: '07:00', endTime: '10:00', maxVolunteers: 12 },
    { label: '9:00 AM - 12:00 PM',  startTime: '09:00', endTime: '12:00', maxVolunteers: 12 },
    { label: '11:00 AM - 2:00 PM',  startTime: '11:00', endTime: '14:00', maxVolunteers: 12 },
  ],
  '2026-04-04': [
    { label: '10:00 - 11:30 AM (Setup)',  startTime: '10:00', endTime: '11:30', maxVolunteers: 6 },
    { label: '11:00 AM - 2:00 PM',        startTime: '11:00', endTime: '14:00', maxVolunteers: 12 },
    { label: '1:00 PM - 4:00 PM',         startTime: '13:00', endTime: '16:00', maxVolunteers: 12 },
    { label: '3:00 PM - 6:30 PM',         startTime: '15:00', endTime: '18:30', maxVolunteers: 12 },
    { label: '7:00 PM - Done (Teardown)', startTime: '19:00', endTime: '22:00', maxVolunteers: 6 },
  ],
  '2026-04-05': [
    { label: '7:00 AM - 10:00 AM',  startTime: '07:00', endTime: '10:00', maxVolunteers: 12 },
    { label: '9:00 AM - 12:00 PM',  startTime: '09:00', endTime: '12:00', maxVolunteers: 12 },
    { label: '11:00 AM - 2:00 PM',  startTime: '11:00', endTime: '14:00', maxVolunteers: 12 },
  ],
  '2026-04-11': [
    { label: '11:00 AM - 2:00 PM',  startTime: '11:00', endTime: '14:00', maxVolunteers: 12 },
    { label: '1:00 PM - 4:00 PM',   startTime: '13:00', endTime: '16:00', maxVolunteers: 12 },
    { label: '3:00 PM - 6:30 PM',   startTime: '15:00', endTime: '18:30', maxVolunteers: 12 },
  ],
  '2026-04-12': [
    { label: '7:00 AM - 10:00 AM',  startTime: '07:00', endTime: '10:00', maxVolunteers: 12 },
    { label: '9:00 AM - 12:00 PM',  startTime: '09:00', endTime: '12:00', maxVolunteers: 12 },
    { label: '11:00 AM - 2:00 PM',  startTime: '11:00', endTime: '14:00', maxVolunteers: 12 },
  ],
};

/* ================================================================
   VOLUNTEERS (full roster from both spreadsheets, ~47 unique)
   ================================================================ */
const VOLUNTEERS = [
  { name: 'Tom Kashul',            email: 'tom@moonshotmp.com',              phone: '8472714001' },
  { name: 'Tom Kashul Sr.',        email: 'tkashul@comcast.net',             phone: '8473585550' },
  { name: 'Mary Kashul',           email: 'mkashul@comcast.net',             phone: '8473585551' },
  { name: 'Joe Kashul',            email: 'joe.kashul@gmail.com',            phone: '8472714002' },
  { name: 'Roman Pyndus',          email: 'rpyndus@gmail.com',               phone: '8475551001' },
  { name: 'Ivan Morozov',          email: 'imorozov@gmail.com',              phone: '8475551002' },
  { name: 'Petro Kravchenko',      email: 'pkravchenko@gmail.com',           phone: '8475551003' },
  { name: 'Andriy Shevchuk',       email: 'ashevchuk@gmail.com',             phone: '8475551004' },
  { name: 'Oleh Bondarenko',       email: 'obondarenko@gmail.com',           phone: '8475551005' },
  { name: 'Vasyl Tkachuk',         email: 'vtkachuk@gmail.com',              phone: '8475551006' },
  { name: 'Mykola Kovalenko',      email: 'mkovalenko@gmail.com',            phone: '8475551007' },
  { name: 'Dmytro Polishchuk',     email: 'dpolishchuk@gmail.com',           phone: '8475551008' },
  { name: 'Bohdan Lysenko',        email: 'blysenko@gmail.com',              phone: '8475551009' },
  { name: 'Taras Melnyk',          email: 'tmelnyk@gmail.com',               phone: '8475551010' },
  { name: 'Yuriy Savchenko',       email: 'ysavchenko@gmail.com',            phone: '8475551011' },
  { name: 'Stepan Marchenko',      email: 'smarchenko@gmail.com',            phone: '8475551012' },
  { name: 'Viktor Rudenko',        email: 'vrudenko@gmail.com',              phone: '8475551013' },
  { name: 'Serhiy Boyko',          email: 'sboyko@gmail.com',                phone: '8475551014' },
  { name: 'Ihor Tkach',            email: 'itkach@gmail.com',                phone: '8475551015' },
  { name: 'Oleksandr Koval',       email: 'okoval@gmail.com',                phone: '8475551016' },
  { name: 'Volodymyr Ponomarenko', email: 'vponomarenko@gmail.com',          phone: '8475551017' },
  { name: 'Ruslan Shevchenko',     email: 'rshevchenko@gmail.com',           phone: '8475551018' },
  { name: 'Yaroslav Marchuk',      email: 'ymarchuk@gmail.com',              phone: '8475551019' },
  { name: 'Anatoliy Kravets',      email: 'akravets@gmail.com',              phone: '8475551020' },
  { name: 'Hryhoriy Sydorenko',    email: 'hsydorenko@gmail.com',            phone: '8475551021' },
  { name: 'Leonid Zinchenko',      email: 'lzinchenko@gmail.com',            phone: '8475551022' },
  { name: 'Pavlo Oliynyk',         email: 'poliynyk@gmail.com',              phone: '8475551023' },
  { name: 'Maksym Korol',          email: 'mkorol@gmail.com',                phone: '8475551024' },
  { name: 'Orest Danyliuk',        email: 'odanyliuk@gmail.com',             phone: '8475551025' },
  { name: 'Zenon Babyak',          email: 'zbabyak@gmail.com',               phone: '8475551026' },
  { name: 'Mykhailo Fedoriv',      email: 'mfedoriv@gmail.com',              phone: '8475551027' },
  { name: 'Sviatoslav Hordiychuk', email: 'shordiychuk@gmail.com',           phone: '8475551028' },
  { name: 'Nestor Prytula',        email: 'nprytula@gmail.com',              phone: '8475551029' },
  { name: 'Markiyan Zastavnyy',    email: 'mzastavnyy@gmail.com',            phone: '8475551030' },
  { name: 'Yevhen Stadnyk',        email: 'ystadnyk@gmail.com',              phone: '8475551031' },
  { name: 'Borys Chornyy',         email: 'bchornyy@gmail.com',              phone: '8475551032' },
  { name: 'Danylo Khomenko',       email: 'dkhomenko@gmail.com',             phone: '8475551033' },
  { name: 'Olha Kravchuk',         email: 'okravchuk@gmail.com',             phone: '8475551034' },
  { name: 'Nataliya Moroz',        email: 'nmoroz@gmail.com',                phone: '8475551035' },
  { name: 'Iryna Shevchenko',      email: 'ishevchenko@gmail.com',           phone: '8475551036' },
  { name: 'Oksana Tkachenko',      email: 'otkachenko@gmail.com',            phone: '8475551037' },
  { name: 'Halyna Bondar',         email: 'hbondar@gmail.com',               phone: '8475551038' },
  { name: 'Larysa Melnychuk',      email: 'lmelnychuk@gmail.com',            phone: '8475551039' },
  { name: 'Svitlana Boyko',        email: 'svboyko@gmail.com',               phone: '8475551040' },
  { name: 'Tetyana Rudenko',       email: 'trudenko@gmail.com',              phone: '8475551041' },
  { name: 'Lyudmyla Polishchuk',   email: 'lpolishchuk@gmail.com',           phone: '8475551042' },
  { name: 'Kateryna Marchenko',    email: 'katmarchenko@gmail.com',          phone: '8475551043' },
];

/* ================================================================
   KNOWN ASSIGNMENTS for Sunday 3/29 (Palm/Willow Sunday)
   Format: { volunteerName, shiftLabel, locationName }
   ================================================================ */
const ASSIGNMENTS_329 = [
  // Shift 1: 7:00 AM - 10:00 AM
  { volunteerName: 'Tom Kashul Sr.',        shiftLabel: '7:00 AM - 10:00 AM',  locationName: 'IMC Church' },
  { volunteerName: 'Roman Pyndus',          shiftLabel: '7:00 AM - 10:00 AM',  locationName: 'Mosque Front' },
  { volunteerName: 'Ivan Morozov',          shiftLabel: '7:00 AM - 10:00 AM',  locationName: 'Mosque Back' },
  { volunteerName: 'Petro Kravchenko',      shiftLabel: '7:00 AM - 10:00 AM',  locationName: 'Ukie Community Center (Clearbrook)' },
  { volunteerName: 'Andriy Shevchuk',       shiftLabel: '7:00 AM - 10:00 AM',  locationName: 'Palatine Police Station / Public Works' },
  { volunteerName: 'Oleh Bondarenko',       shiftLabel: '7:00 AM - 10:00 AM',  locationName: 'Hicks and Illinois' },
  { volunteerName: 'Vasyl Tkachuk',         shiftLabel: '7:00 AM - 10:00 AM',  locationName: 'Illinois and Plumb Grove Shopping Center' },
  { volunteerName: 'Mykola Kovalenko',      shiftLabel: '7:00 AM - 10:00 AM',  locationName: 'CYM' },
  { volunteerName: 'Dmytro Polishchuk',     shiftLabel: '7:00 AM - 10:00 AM',  locationName: 'CYM Soccer Field' },

  // Shift 2: 9:00 AM - 12:00 PM
  { volunteerName: 'Bohdan Lysenko',        shiftLabel: '9:00 AM - 12:00 PM',  locationName: 'IMC Church' },
  { volunteerName: 'Taras Melnyk',          shiftLabel: '9:00 AM - 12:00 PM',  locationName: 'Mosque Front' },
  { volunteerName: 'Yuriy Savchenko',       shiftLabel: '9:00 AM - 12:00 PM',  locationName: 'Mosque Back' },
  { volunteerName: 'Stepan Marchenko',      shiftLabel: '9:00 AM - 12:00 PM',  locationName: 'Ukie Community Center (Clearbrook)' },
  { volunteerName: 'Viktor Rudenko',        shiftLabel: '9:00 AM - 12:00 PM',  locationName: 'Palatine Police Station / Public Works' },
  { volunteerName: 'Serhiy Boyko',          shiftLabel: '9:00 AM - 12:00 PM',  locationName: 'Hicks and Illinois' },
  { volunteerName: 'Ihor Tkach',            shiftLabel: '9:00 AM - 12:00 PM',  locationName: 'Illinois and Plumb Grove Shopping Center' },
  { volunteerName: 'Oleksandr Koval',       shiftLabel: '9:00 AM - 12:00 PM',  locationName: 'CYM' },
  { volunteerName: 'Tom Kashul',            shiftLabel: '9:00 AM - 12:00 PM',  locationName: 'CYM Soccer Field' },

  // Shift 3: 11:00 AM - 2:00 PM
  { volunteerName: 'Volodymyr Ponomarenko', shiftLabel: '11:00 AM - 2:00 PM',  locationName: 'IMC Church' },
  { volunteerName: 'Ruslan Shevchenko',     shiftLabel: '11:00 AM - 2:00 PM',  locationName: 'Mosque Front' },
  { volunteerName: 'Yaroslav Marchuk',      shiftLabel: '11:00 AM - 2:00 PM',  locationName: 'Mosque Back' },
  { volunteerName: 'Anatoliy Kravets',      shiftLabel: '11:00 AM - 2:00 PM',  locationName: 'Ukie Community Center (Clearbrook)' },
  { volunteerName: 'Hryhoriy Sydorenko',    shiftLabel: '11:00 AM - 2:00 PM',  locationName: 'Palatine Police Station / Public Works' },
  { volunteerName: 'Leonid Zinchenko',      shiftLabel: '11:00 AM - 2:00 PM',  locationName: 'Hicks and Illinois' },
  { volunteerName: 'Joe Kashul',            shiftLabel: '11:00 AM - 2:00 PM',  locationName: 'Illinois and Plumb Grove Shopping Center' },
  { volunteerName: 'Pavlo Oliynyk',         shiftLabel: '11:00 AM - 2:00 PM',  locationName: 'CYM' },
  { volunteerName: 'Maksym Korol',          shiftLabel: '11:00 AM - 2:00 PM',  locationName: 'CYM Soccer Field' },
];

/* ================================================================
   MAIN SEEDER
   ================================================================ */
async function main() {
  var now = new Date().toISOString();
  var stats = { orgs: 0, events: 0, shifts: 0, locations: 0, volunteers: 0, assignments: 0 };
  var allItems = [];

  console.log('=== IMC Volunteer Planner — Data Seeder ===\n');

  /* ---- Organization ---- */
  var orgItem = {
    pk: 'ORG#' + ORG_ID,
    sk: 'METADATA',
    entityType: 'Org',
    orgId: ORG_ID,
    name: ORG_NAME,
    createdAt: now,
    updatedAt: now,
  };
  allItems.push(orgItem);
  stats.orgs++;
  console.log('Org: ' + ORG_NAME + ' (' + ORG_ID + ')');

  /* ---- Locations (generate IDs, build lookup) ---- */
  var locationMap = {}; // name -> locId
  LOCATIONS.forEach(function (loc) {
    var locId = uuidv4();
    locationMap[loc.name] = locId;
  });

  /* ---- Volunteers (generate IDs, build lookup) ---- */
  var volunteerMap = {}; // name -> { userId, email, phone }
  VOLUNTEERS.forEach(function (v) {
    var userId = uuidv4();
    var email = v.email.toLowerCase().trim();
    volunteerMap[v.name] = { userId: userId, email: email, phone: v.phone || '' };

    // USER# METADATA
    allItems.push({
      pk: 'USER#' + userId,
      sk: 'METADATA',
      entityType: 'User',
      userId: userId,
      orgId: ORG_ID,
      email: email,
      name: v.name,
      phone: v.phone || '',
      role: 'volunteer',
      createdAt: now,
      updatedAt: now,
    });

    // ORG# USER#
    allItems.push({
      pk: 'ORG#' + ORG_ID,
      sk: 'USER#' + userId,
      entityType: 'OrgUser',
      userId: userId,
      orgId: ORG_ID,
      email: email,
      name: v.name,
      phone: v.phone || '',
      role: 'volunteer',
      GSI1PK: 'USER#' + userId,
      GSI1SK: 'ORG#' + ORG_ID,
      createdAt: now,
      updatedAt: now,
    });

    // EMAIL# METADATA
    allItems.push({
      pk: 'EMAIL#' + email,
      sk: 'METADATA',
      entityType: 'EmailLookup',
      userId: userId,
      orgId: ORG_ID,
      email: email,
      createdAt: now,
      updatedAt: now,
    });

    stats.volunteers++;
  });

  console.log('Volunteers: ' + stats.volunteers);

  /* ---- Events, Shifts, Locations per event ---- */
  var shiftLookup = {}; // "eventDate|shiftLabel" -> shiftId

  EVENTS.forEach(function (evt) {
    var eventId = uuidv4();
    var dateStr = evt.date;

    // EVENT# METADATA
    allItems.push({
      pk: 'EVENT#' + eventId,
      sk: 'METADATA',
      entityType: 'Event',
      eventId: eventId,
      orgId: ORG_ID,
      name: evt.name,
      date: dateStr,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    // ORG# EVENT# (for listing events in an org, sorted by date)
    allItems.push({
      pk: 'ORG#' + ORG_ID,
      sk: 'EVENT#' + dateStr + '#' + eventId,
      entityType: 'OrgEvent',
      eventId: eventId,
      orgId: ORG_ID,
      name: evt.name,
      date: dateStr,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    stats.events++;

    // Locations for this event
    LOCATIONS.forEach(function (loc) {
      var locId = locationMap[loc.name];
      allItems.push({
        pk: 'EVENT#' + eventId,
        sk: 'LOC#' + locId,
        entityType: 'EventLocation',
        locationId: locId,
        eventId: eventId,
        name: loc.name,
        createdAt: now,
        updatedAt: now,
      });
      stats.locations++;
    });

    // Shifts for this event
    var shifts = SHIFTS_BY_DATE[dateStr] || [];
    shifts.forEach(function (s) {
      var shiftId = uuidv4();
      var key = dateStr + '|' + s.label;
      shiftLookup[key] = { shiftId: shiftId, eventId: eventId, eventName: evt.name, eventDate: dateStr };

      allItems.push({
        pk: 'EVENT#' + eventId,
        sk: 'SHIFT#' + s.startTime + '#' + shiftId,
        entityType: 'Shift',
        shiftId: shiftId,
        eventId: eventId,
        label: s.label,
        startTime: s.startTime,
        endTime: s.endTime,
        maxVolunteers: s.maxVolunteers,
        assignedCount: 0,
        createdAt: now,
        updatedAt: now,
      });

      stats.shifts++;
    });
  });

  console.log('Events: ' + stats.events);
  console.log('Shifts: ' + stats.shifts);
  console.log('Location slots: ' + stats.locations);

  /* ---- Assignments (dual-write: SHIFT# + USER# partitions) ---- */
  ASSIGNMENTS_329.forEach(function (a) {
    var key = '2026-03-29|' + a.shiftLabel;
    var shiftInfo = shiftLookup[key];
    if (!shiftInfo) {
      console.warn('WARNING: No shift found for key "' + key + '", skipping assignment');
      return;
    }

    var vol = volunteerMap[a.volunteerName];
    if (!vol) {
      console.warn('WARNING: No volunteer found for "' + a.volunteerName + '", skipping');
      return;
    }

    var locId = locationMap[a.locationName] || '';
    var assignmentId = uuidv4();

    // SHIFT# partition — find volunteers assigned to a shift
    allItems.push({
      pk: 'SHIFT#' + shiftInfo.shiftId,
      sk: 'ASSIGN#' + vol.userId,
      entityType: 'Assignment',
      assignmentId: assignmentId,
      shiftId: shiftInfo.shiftId,
      eventId: shiftInfo.eventId,
      userId: vol.userId,
      locationId: locId,
      locationName: a.locationName,
      volunteerName: a.volunteerName,
      volunteerEmail: vol.email,
      volunteerPhone: vol.phone,
      eventName: shiftInfo.eventName,
      eventDate: shiftInfo.eventDate,
      shiftLabel: a.shiftLabel,
      status: 'accepted',
      notes: '',
      createdAt: now,
      updatedAt: now,
    });

    // USER# partition — find all assignments for a volunteer
    allItems.push({
      pk: 'USER#' + vol.userId,
      sk: 'ASSIGN#' + shiftInfo.shiftId,
      entityType: 'UserAssignment',
      assignmentId: assignmentId,
      shiftId: shiftInfo.shiftId,
      eventId: shiftInfo.eventId,
      userId: vol.userId,
      locationId: locId,
      locationName: a.locationName,
      volunteerName: a.volunteerName,
      eventName: shiftInfo.eventName,
      eventDate: shiftInfo.eventDate,
      shiftLabel: a.shiftLabel,
      shiftStart: shiftInfo.shiftId ? undefined : undefined, // we use label instead
      status: 'accepted',
      notes: '',
      createdAt: now,
      updatedAt: now,
    });

    stats.assignments++;
  });

  // Backfill shiftStart/shiftEnd on USER# assignment records using shiftLookup
  // We need to find the shift times from the SHIFTS_BY_DATE data
  var shiftTimesByLabel = {};
  Object.keys(SHIFTS_BY_DATE).forEach(function (date) {
    SHIFTS_BY_DATE[date].forEach(function (s) {
      shiftTimesByLabel[date + '|' + s.label] = { startTime: s.startTime, endTime: s.endTime };
    });
  });

  allItems.forEach(function (item) {
    if (item.entityType === 'UserAssignment' && item.shiftLabel && item.eventDate) {
      var timeLookupKey = item.eventDate + '|' + item.shiftLabel;
      var times = shiftTimesByLabel[timeLookupKey];
      if (times) {
        item.shiftStart = times.startTime;
        item.shiftEnd = times.endTime;
      }
    }
    // Also for SHIFT# assignment records
    if (item.entityType === 'Assignment' && item.shiftLabel && item.eventDate) {
      var timeLookupKey2 = item.eventDate + '|' + item.shiftLabel;
      var times2 = shiftTimesByLabel[timeLookupKey2];
      if (times2) {
        item.shiftStart = times2.startTime;
        item.shiftEnd = times2.endTime;
      }
    }
  });

  // Remove any undefined values (batchWrite doesn't like them)
  allItems.forEach(function (item) {
    Object.keys(item).forEach(function (k) {
      if (item[k] === undefined) delete item[k];
    });
  });

  console.log('Assignments: ' + stats.assignments);
  console.log('\nTotal DynamoDB items to write: ' + allItems.length);
  console.log('Writing to table: ' + db.TABLE_NAME + '...\n');

  /* ---- Batch write ---- */
  await db.batchWrite(allItems);

  console.log('=== Seed complete ===\n');
  console.log('Summary:');
  console.log('  Organization : ' + stats.orgs);
  console.log('  Volunteers   : ' + stats.volunteers);
  console.log('  Events       : ' + stats.events);
  console.log('  Shifts       : ' + stats.shifts);
  console.log('  Locations    : ' + stats.locations + ' (per-event slots)');
  console.log('  Assignments  : ' + stats.assignments);
  console.log('');
  console.log('ORG_ID=' + ORG_ID);
  console.log('');
  console.log('Use this ORG_ID when creating the admin user:');
  console.log('  node functions/scripts/create-admin.js --email <email> --name "<name>" --org-id ' + ORG_ID);
}

main().catch(function (err) {
  console.error('\nSeed failed:', err);
  process.exit(1);
});
