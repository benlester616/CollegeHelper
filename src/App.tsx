import { useMemo, useState } from 'react';
import schoolsData from './data/schools.json';

type AcademicSystem = 'US GPA' | 'IB' | 'A-Level';
type MajorCategory =
  | 'Computer Science'
  | 'Engineering'
  | 'Business'
  | 'Economics'
  | 'Medicine'
  | 'Law'
  | 'Humanities'
  | 'Social Sciences'
  | 'Natural Sciences';
type MajorCompetitiveness = 'high' | 'medium' | 'low';

type School = {
  name: string;
  region: 'US' | 'Europe' | 'Asia';
  location: string;
  acceptance_rate: number | null;
  avg_gpa: number | null;
  avg_sat: number | null;
  tuition_usd_per_year: number | null;
  application_deadline: string;
  campus_setting: 'urban' | 'suburban' | 'rural';
  international_student_percent: number | null;
  student_life_rating: number | null;
  culture_tags: string[];
  available_majors: MajorCategory[];
  major_competitiveness: Partial<Record<MajorCategory, MajorCompetitiveness>>;
  last_updated: string;
  data_source: string;
};

type Preference = {
  academic_system: AcademicSystem;
  gpa: number;
  ib_score: number | '';
  a_level_grades: string;
  sat: number | '';
  major: MajorCategory;
  extracurricular: 'low' | 'medium' | 'high';
  campusSetting: 'urban' | 'suburban' | 'rural';
  social: 'quiet' | 'balanced' | 'active';
  diversityImportance: 'low' | 'medium' | 'high';
  culturePreference: 'collaborative' | 'competitive' | 'mixed';
  budget: number;
  region: 'No preference' | 'Asia' | 'US' | 'Europe';
};

const schools = schoolsData as School[];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeIbScore = (score: number) => {
  if (score <= 0) return 0;
  if (score >= 45) return 4.0;

  const breakpoints = [
    { ib: 0, gpa: 0 },
    { ib: 35, gpa: 3.5 },
    { ib: 40, gpa: 3.8 },
    { ib: 45, gpa: 4.0 },
  ];

  for (let i = 1; i < breakpoints.length; i += 1) {
    const prev = breakpoints[i - 1];
    const next = breakpoints[i];
    if (score <= next.ib) {
      const ratio = (score - prev.ib) / (next.ib - prev.ib);
      return prev.gpa + ratio * (next.gpa - prev.gpa);
    }
  }

  return 4.0;
};

const gradeToGpa = (grade: string) => {
  const normalized = grade.trim().toUpperCase();
  if (normalized === 'A*' || normalized === 'A+' || normalized === 'ASTAR') return 4.0;
  if (normalized === 'A') return 3.7;
  if (normalized === 'B') return 3.3;
  if (normalized === 'C') return 3.0;
  if (normalized === 'D') return 2.0;
  return NaN;
};

const normalizeALevelGrades = (grades: string) => {
  const values = grades
    .split(',')
    .map((grade) => grade.trim())
    .filter(Boolean)
    .map(gradeToGpa)
    .filter((value) => !Number.isNaN(value));

  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const getNormalizedGpa = (prefs: Preference) => {
  if (prefs.academic_system === 'US GPA') {
    return clamp(prefs.gpa, 0, 4);
  }

  if (prefs.academic_system === 'IB') {
    return clamp(normalizeIbScore(Number(prefs.ib_score)), 0, 4);
  }

  if (prefs.academic_system === 'A-Level') {
    return clamp(normalizeALevelGrades(prefs.a_level_grades), 0, 4);
  }

  return 0;
};

const majorCategories: MajorCategory[] = [
  'Computer Science',
  'Engineering',
  'Business',
  'Economics',
  'Medicine',
  'Law',
  'Humanities',
  'Social Sciences',
  'Natural Sciences',
];

const mapSocialTarget = (social: Preference['social']) => {
  if (social === 'quiet') return 2;
  if (social === 'balanced') return 3;
  return 5;
};

const mapDiversityStrength = (percent: number) => {
  if (percent >= 35) return 5;
  if (percent >= 25) return 4;
  if (percent >= 18) return 3;
  if (percent >= 10) return 2;
  return 1;
};

const getAcademicScore = (prefs: Preference, school: School) => {
  const normalizedGpa = getNormalizedGpa(prefs);
  const hasMajor = school.available_majors.includes(prefs.major);
  if (!hasMajor) {
    return 0;
  }

  const extraScore = prefs.extracurricular === 'high' ? 20 : prefs.extracurricular === 'medium' ? 10 : 0;
  const hasGpa = school.avg_gpa !== null;
  const hasSat = school.avg_sat !== null && prefs.sat !== '';

  const gpaScore = hasGpa ? clamp(50 + (normalizedGpa - school.avg_gpa!) * 20, 0, 100) : 50;
  const satScore = hasSat ? clamp(50 + ((prefs.sat as number) - school.avg_sat!) / 150 * 20, 0, 100) : 50;

  let baseScore;
  if (hasGpa && hasSat) {
    baseScore = clamp(gpaScore * 0.5 + satScore * 0.3 + extraScore * 1, 0, 100);
  } else if (hasGpa) {
    baseScore = clamp(gpaScore * 0.7 + extraScore * 1.5, 0, 100);
  } else if (hasSat) {
    baseScore = clamp(satScore * 0.7 + extraScore * 1.5, 0, 100);
  } else {
    baseScore = clamp(45 + extraScore * 1.2, 0, 100);
  }

  const competitiveness = school.major_competitiveness[prefs.major] ?? 'low';
  const penalty = competitiveness === 'high' ? 15 : competitiveness === 'medium' ? 8 : 0;
  return clamp(Math.round(baseScore - penalty), 0, 100);
};

const getAcademicClassification = (score: number) => {
  if (score >= 80) return 'Safety';
  if (score >= 50) return 'Target';
  return 'Reach';
};

const getAcademicDetails = (prefs: Preference, school: School) => {
  const messages: string[] = [];
  const normalizedGpa = getNormalizedGpa(prefs);
  const hasMajor = school.available_majors.includes(prefs.major);

  messages.push(`Academic system: ${prefs.academic_system}. Normalized GPA: ${normalizedGpa.toFixed(2)}.`);

  if (prefs.academic_system === 'IB') {
    messages.push(`IB total score: ${prefs.ib_score || 'not entered'} based on a 0–45 scale.`);
  }

  if (prefs.academic_system === 'A-Level') {
    messages.push(`A-Level grades: ${prefs.a_level_grades || 'not entered'}.`);
  }

  if (!hasMajor) {
    messages.push('This school does not offer your intended field of study.');
    return messages;
  }

  if (school.avg_gpa !== null) {
    const gpaDiff = normalizedGpa - school.avg_gpa;
    if (gpaDiff >= 0) {
      messages.push(`Your normalized GPA is ${gpaDiff.toFixed(2)} above the school average.`);
    } else {
      messages.push(`Your normalized GPA is ${Math.abs(gpaDiff).toFixed(2)} below the school average.`);
    }
  } else {
    messages.push('School average GPA is unavailable in the dataset.');
  }

  if (prefs.sat === '') {
    messages.push('SAT score is not provided, so the evaluation relies more on GPA normalization and extracurricular strength.');
  } else if (school.avg_sat !== null) {
    const satDiff = prefs.sat - school.avg_sat;
    if (satDiff >= 0) {
      messages.push(`Your SAT is ${satDiff} points above the average.`);
    } else {
      messages.push(`Your SAT is ${Math.abs(satDiff)} points below the average.`);
    }
  } else {
    messages.push('School average SAT is unavailable in the dataset.');
  }

  if (prefs.extracurricular === 'high') {
    messages.push('Your extracurricular strength is strong and improves the academic match.');
  } else if (prefs.extracurricular === 'medium') {
    messages.push('A medium extracurricular profile is typical; highlight leadership for stronger review.');
  } else {
    messages.push('A low extracurricular strength reduces your admissions margin, especially for competitive programs.');
  }

  return messages;
};

const getMajorFitDetails = (prefs: Preference, school: School) => {
  const messages: string[] = [];
  const isOffered = school.available_majors.includes(prefs.major);
  const competitiveness = school.major_competitiveness[prefs.major] ?? 'medium';

  if (!isOffered) {
    messages.push(`This school does not offer ${prefs.major}.`);
    messages.push('Consider schools where your intended major is available or explore a related program here.');
    return messages;
  }

  messages.push(`${prefs.major} is ${competitiveness === 'high' ? 'highly' : competitiveness === 'medium' ? 'moderately' : 'less'} competitive at this university.`);
  if (competitiveness === 'high') {
    messages.push('Admission for this major is more selective than the general applicant pool.');
  } else if (competitiveness === 'medium') {
    messages.push('This major has a balanced competitiveness profile at this school.');
  } else {
    messages.push('This major is one of the lower-competition programs here, which may improve your chances.');
  }

  return messages;
};

const getPersonalFitScore = (prefs: Preference, school: School) => {
  let score = 0;

  if (prefs.campusSetting === school.campus_setting) {
    score += 20;
  }

  const schoolLifeRating = school.student_life_rating ?? 3;
  const socialDiff = Math.abs(mapSocialTarget(prefs.social) - schoolLifeRating);
  score += clamp(20 - socialDiff * 4, 0, 20);

  const diversityStrength = school.international_student_percent !== null ? mapDiversityStrength(school.international_student_percent) : 3;
  if (prefs.diversityImportance === 'high') {
    score += diversityStrength >= 4 ? 20 : clamp(10 - (4 - diversityStrength) * 4, 0, 20);
  } else if (prefs.diversityImportance === 'medium') {
    score += clamp(diversityStrength * 3, 0, 15);
  } else {
    score += clamp(10 + diversityStrength * 1, 0, 10);
  }

  const cultureMatch = school.culture_tags.includes(prefs.culturePreference);
  if (prefs.culturePreference === 'mixed') {
    score += school.culture_tags.includes('mixed') ? 20 : 12;
  } else {
    score += cultureMatch ? 20 : 8;
  }

  if (school.tuition_usd_per_year !== null) {
    if (school.tuition_usd_per_year <= prefs.budget) {
      score += 15;
    } else if (school.tuition_usd_per_year <= prefs.budget + 12000) {
      score += 6;
    }
  }

  if (prefs.region === 'No preference') {
    score += 0;
  } else if (school.region === prefs.region) {
    score += 15;
  } else {
    score -= 10;
  }

  return clamp(Math.round(score), 0, 100);
};

const getPersonalDetails = (prefs: Preference, school: School) => {
  const messages: string[] = [];

  if (prefs.campusSetting === school.campus_setting) {
    messages.push(`Campus setting matches your preference for ${prefs.campusSetting} locations.`);
  } else {
    messages.push(`Campus setting is ${school.campus_setting}, which differs from your preferred ${prefs.campusSetting} setting.`);
  }

  const target = mapSocialTarget(prefs.social);
  if (school.student_life_rating !== null) {
    if (school.student_life_rating >= target) {
      messages.push(`Student life is rated ${school.student_life_rating}/5, aligned with your ${prefs.social} social preference.`);
    } else {
      messages.push(`Student life is rated ${school.student_life_rating}/5, which may feel quieter than your ${prefs.social} preference.`);
    }
  } else {
    messages.push('Student life rating is unavailable for this school.');
  }

  if (school.international_student_percent !== null) {
    if (prefs.diversityImportance === 'high' && school.international_student_percent < 15) {
      messages.push(`International representation is ${school.international_student_percent}%, which is low for your high diversity preference.`);
    } else {
      messages.push(`International student share is ${school.international_student_percent}%, which supports your diversity preference.`);
    }
  } else {
    messages.push('Diversity data is unavailable for this school.');
  }

  if (school.culture_tags.includes(prefs.culturePreference) || prefs.culturePreference === 'mixed') {
    messages.push(`Culture tags (${school.culture_tags.join(', ')}) align well with your preference for ${prefs.culturePreference} culture.`);
  } else {
    messages.push(`Campus culture tags (${school.culture_tags.join(', ')}) are not a strong match for your ${prefs.culturePreference} preference.`);
  }

  if (prefs.region === 'No preference') {
    messages.push(`You have no regional preference, so location is not a fit factor.`);
  } else if (school.region === prefs.region) {
    messages.push(`This school is in your preferred region (${school.region}).`);
  } else {
    messages.push(`This school is outside your preferred region (${prefs.region}); that lowers its personal fit score.`);
  }

  if (school.tuition_usd_per_year !== null) {
    if (school.tuition_usd_per_year <= prefs.budget) {
      messages.push(`Tuition fits your budget at $${school.tuition_usd_per_year.toLocaleString()} / year.`);
    } else {
      messages.push(`Tuition of $${school.tuition_usd_per_year.toLocaleString()} exceeds your budget of $${prefs.budget.toLocaleString()}.`);
    }
  } else {
    messages.push('Tuition data is unavailable for this school.');
  }

  return messages;
};

const getMajorActionRecommendation = (major: MajorCategory, isOffered: boolean) => {
  if (!isOffered) {
    return 'Seek schools that offer your intended major or choose a related program available here.';
  }

  switch (major) {
    case 'Computer Science':
      return 'Build technical projects or a coding portfolio to demonstrate CS readiness.';
    case 'Engineering':
      return 'Highlight strong STEM projects and engineering-related coursework.';
    case 'Business':
      return 'Develop leadership and real-world experience through clubs or internships.';
    case 'Economics':
      return 'Showcase quantitative skills and internships or coursework in analytics and finance.';
    case 'Medicine':
      return 'Gain clinical exposure, volunteering, and strong science preparation.';
    case 'Law':
      return 'Strengthen writing, debate, and civic engagement for law readiness.';
    case 'Humanities':
      return 'Demonstrate strong writing, research, and cultural curiosity.';
    case 'Social Sciences':
      return 'Pursue research, internships, or community work that highlights social inquiry.';
    case 'Natural Sciences':
      return 'Emphasize lab experience, research, and strong STEM coursework.';
    default:
      return 'Build experience in your intended field of study.';
  }
};

const getActionPlan = (prefs: Preference, school: School, academicScore: number, fitScore: number) => {
  const actions: string[] = [];
  const isReach = academicScore < 50;
  const isOffered = school.available_majors.includes(prefs.major);
  const satGap = prefs.sat === '' || school.avg_sat === null ? null : school.avg_sat - prefs.sat;
  const normalizedGpa = getNormalizedGpa(prefs);
  const gpaGap = school.avg_gpa === null ? null : school.avg_gpa - normalizedGpa;

  if (gpaGap !== null && gpaGap > 0.1) {
    actions.push(`Strengthen GPA or academic narrative; you're ${gpaGap.toFixed(2)} below the average.`);
  }

  if (prefs.sat === '' || (satGap !== null && satGap > 40)) {
    actions.push('Improve your standardized test profile or submit additional academic evidence.');
  }

  if (prefs.extracurricular === 'low') {
    actions.push('Boost extracurricular impact by leading a project or adding a strong commitment example.');
  }

  if (school.tuition_usd_per_year !== null && school.tuition_usd_per_year > prefs.budget) {
    actions.push('Research scholarships, aid, or lower-cost alternatives to make this option more affordable.');
  }

  if (!isOffered) {
    actions.push(getMajorActionRecommendation(prefs.major, false));
  } else {
    actions.push(getMajorActionRecommendation(prefs.major, true));
  }

  if (fitScore < 60) {
    actions.push('Review campus life and culture closely to confirm whether this environment is a strong fit.');
  }

  actions.push(`Prepare your application before the ${school.application_deadline} deadline.`);

  if (actions.length > 5) {
    return actions.slice(0, 5);
  }

  return actions;
};

function App() {
  const [preferences, setPreferences] = useState<Preference>({
    academic_system: 'US GPA',
    gpa: 3.5,
    ib_score: '',
    a_level_grades: 'A*, A, B',
    sat: 1300,
    major: 'Computer Science',
    extracurricular: 'medium',
    campusSetting: 'suburban',
    social: 'balanced',
    diversityImportance: 'medium',
    culturePreference: 'mixed',
    budget: 40000,
    region: 'No preference'
  });

  const [schoolInput, setSchoolInput] = useState('');
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [selectionMessage, setSelectionMessage] = useState('');

  const availableSchoolNames = useMemo(() => schools.map((school) => school.name).sort(), []);

  const findSchoolByName = (name: string) =>
    schools.find((school) => school.name.toLowerCase() === name.trim().toLowerCase());

  const selectedSchoolObjects = useMemo(
    () => schools.filter((school) => selectedSchools.includes(school.name)),
    [selectedSchools]
  );

  const results = useMemo(
    () =>
      selectedSchoolObjects.map((school) => {
        const academicScore = getAcademicScore(preferences, school);
        const personalFitScore = getPersonalFitScore(preferences, school);
        const overallScore = Math.round(academicScore * 0.6 + personalFitScore * 0.4);
        const majorOffered = school.available_majors.includes(preferences.major);
        const majorCompetitiveness = school.major_competitiveness[preferences.major] ?? 'medium';
        return {
          school,
          academicScore,
          personalFitScore,
          overallScore,
          classification: getAcademicClassification(academicScore),
          academicDetails: getAcademicDetails(preferences, school),
          personalDetails: getPersonalDetails(preferences, school),
          majorOffered,
          majorCompetitiveness,
          majorFitDetails: getMajorFitDetails(preferences, school),
          actionPlan: getActionPlan(preferences, school, academicScore, personalFitScore)
        };
      }),
    [preferences, selectedSchoolObjects]
  );

  const handlePreferenceChange = (field: keyof Preference, value: string | number) => {
    setPreferences((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddSchool = () => {
    const trimmed = schoolInput.trim();
    if (!trimmed) {
      setSelectionMessage('Enter a university name from the database.');
      return;
    }

    const school = findSchoolByName(trimmed);
    if (!school) {
      setSelectionMessage('School not found in database.');
      return;
    }

    if (selectedSchools.includes(school.name)) {
      setSelectionMessage('This university is already added.');
      return;
    }

    if (selectedSchools.length >= 5) {
      setSelectionMessage('You can add up to 5 universities only.');
      return;
    }

    setSelectedSchools((prev) => [...prev, school.name]);
    setSchoolInput('');
    setSelectionMessage('School added successfully.');
  };

  const handleRemoveSchool = (schoolName: string) => {
    setSelectedSchools((prev) => prev.filter((name) => name !== schoolName));
    setSelectionMessage('University removed.');
  };

  return (
    <div className="app-shell">
      <header className="header">
        <h1>College Helper</h1>
        <p>Assess academic fit and personal fit across selected universities with clear recommendations.</p>
      </header>

      <div className="grid-2">
        <section className="card">
          <h2 className="section-title">Your Academic & Personal Profile</h2>
          <div className="form-row medium-grid">
            <label>
              Academic System
              <select
                value={preferences.academic_system}
                onChange={(event) => handlePreferenceChange('academic_system', event.target.value)}
              >
                <option value="US GPA">US GPA</option>
                <option value="IB">IB</option>
                <option value="A-Level">A-Level</option>
              </select>
            </label>
            {preferences.academic_system === 'US GPA' && (
              <label>
                GPA (0.0–4.0)
                <input
                  type="number"
                  min="0"
                  max="4"
                  step="0.01"
                  value={preferences.gpa}
                  onChange={(event) => handlePreferenceChange('gpa', Number(event.target.value))}
                />
              </label>
            )}
            {preferences.academic_system === 'IB' && (
              <label>
                IB Score (0–45)
                <input
                  type="number"
                  min="0"
                  max="45"
                  step="1"
                  value={preferences.ib_score}
                  onChange={(event) => handlePreferenceChange('ib_score', event.target.value === '' ? '' : Number(event.target.value))}
                />
              </label>
            )}
            {preferences.academic_system === 'A-Level' && (
              <label>
                A-Level Grades
                <input
                  type="text"
                  value={preferences.a_level_grades}
                  onChange={(event) => handlePreferenceChange('a_level_grades', event.target.value)}
                  placeholder="A*, A, B"
                />
              </label>
            )}
          </div>

          <div className="form-row medium-grid" style={{ marginTop: '16px' }}>
            <label>
              SAT Score (optional)
              <input
                type="number"
                min="400"
                max="1600"
                step="10"
                value={preferences.sat}
                onChange={(event) => handlePreferenceChange('sat', event.target.value === '' ? '' : Number(event.target.value))}
              />
            </label>
            <label>
              Intended Major
              <select
                value={preferences.major}
                onChange={(event) => handlePreferenceChange('major', event.target.value)}
              >
                {majorCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-row medium-grid" style={{ marginTop: '16px' }}>
            <label>
              Extracurricular Strength
              <select
                value={preferences.extracurricular}
                onChange={(event) => handlePreferenceChange('extracurricular', event.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label>
              Preferred Campus Setting
              <select
                value={preferences.campusSetting}
                onChange={(event) => handlePreferenceChange('campusSetting', event.target.value)}
              >
                <option value="urban">Urban</option>
                <option value="suburban">Suburban</option>
                <option value="rural">Rural</option>
              </select>
            </label>
            <label>
              Social Environment
              <select
                value={preferences.social}
                onChange={(event) => handlePreferenceChange('social', event.target.value)}
              >
                <option value="quiet">Quiet</option>
                <option value="balanced">Balanced</option>
                <option value="active">Active</option>
              </select>
            </label>
          </div>

          <div className="form-row medium-grid" style={{ marginTop: '16px' }}>
            <label>
              Diversity Importance
              <select
                value={preferences.diversityImportance}
                onChange={(event) => handlePreferenceChange('diversityImportance', event.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label>
              Campus Culture Preference
              <select
                value={preferences.culturePreference}
                onChange={(event) => handlePreferenceChange('culturePreference', event.target.value)}
              >
                <option value="collaborative">Collaborative</option>
                <option value="competitive">Competitive</option>
                <option value="mixed">Mixed</option>
              </select>
            </label>
            <label>
              Budget (USD/year)
              <input
                type="number"
                min="0"
                step="500"
                value={preferences.budget}
                onChange={(event) => handlePreferenceChange('budget', Number(event.target.value))}
              />
            </label>
          </div>

          <div className="form-row" style={{ marginTop: '16px' }}>
            <label>
              Preferred Region
              <select
                value={preferences.region}
                onChange={(event) => handlePreferenceChange('region', event.target.value)}
              >
                <option value="No preference">No preference</option>
                <option value="Asia">Asia</option>
                <option value="US">US</option>
                <option value="Europe">Europe</option>
              </select>
            </label>
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">Select Your Schools</h2>
          <p className="small-note">Enter up to 5 universities from the built-in dataset below.</p>
          <div className="form-row" style={{ gap: '12px' }}>
            <label style={{ flex: 1 }}>
              University Name
              <input
                list="school-options"
                value={schoolInput}
                onChange={(event) => setSchoolInput(event.target.value)}
                placeholder="Start typing a school name"
              />
              <datalist id="school-options">
                {availableSchoolNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
            <button type="button" onClick={handleAddSchool} style={{ alignSelf: 'end' }}>
              Add School
            </button>
          </div>

          <p className="small-note">Selected: {selectedSchools.length} / 5</p>
          {selectionMessage ? <div className="small-note" style={{ color: '#b91c1c' }}>{selectionMessage}</div> : null}

          {selectedSchools.length > 0 ? (
            <div style={{ marginTop: '16px' }}>
              <strong>Selected universities</strong>
              <ul className="actions-list" style={{ marginTop: '12px' }}>
                {selectedSchools.map((name) => (
                  <li key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{name}</span>
                    <button type="button" onClick={() => handleRemoveSchool(name)} style={{ background: '#ef4444' }}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="small-note">No universities selected yet. Add a school above to start the evaluation.</p>
          )}

          <div className="card" style={{ marginTop: '18px', padding: '16px' }}>
            <h3 className="section-title">Quick Guidance</h3>
            <ul className="explanations-list">
              <li>Enter schools exactly as they appear in the database.</li>
              <li>Unlisted schools will be reported as not found.</li>
              <li>Only selected schools will be evaluated in the results below.</li>
            </ul>
          </div>
        </section>
      </div>

      <div style={{ marginTop: '24px' }}>
        {selectedSchools.length === 0 ? (
          <section className="card result-card">
            <h3 className="section-title">No schools selected yet</h3>
            <p className="small-note">Add up to 5 universities in the school selection section to see evaluations here.</p>
          </section>
        ) : (
          results.map((result) => (
            <section key={result.school.name} className="card result-card">
              <div className="result-summary">
                <div className="summary-item">
                  <strong>{result.school.name}</strong>
                  <div style={{ marginTop: '8px' }}>
                    <span className={`status-pill status-${result.classification.toLowerCase()}`}>{result.classification}</span>
                  </div>
                </div>
                <div className="summary-item">
                  <div>Academic Match</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{Math.round(result.academicScore)}</div>
                </div>
                <div className="summary-item">
                  <div>Personal Fit</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{result.personalFitScore}</div>
                </div>
                <div className="summary-item">
                  <div>Overall Score</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{result.overallScore}</div>
                </div>
              </div>

              <div className="grid-2" style={{ gap: '20px' }}>
                <div>
                  <h3 className="section-title">Academic Breakdown</h3>
                  <ul className="breakdown-list">
                    <li>School average GPA: {result.school.avg_gpa !== null ? result.school.avg_gpa.toFixed(2) : 'N/A'}</li>
                    <li>School average SAT: {result.school.avg_sat !== null ? result.school.avg_sat : 'N/A'}</li>
                    <li>Acceptance rate: {result.school.acceptance_rate !== null ? `${result.school.acceptance_rate}%` : 'N/A'}</li>
                    <li>Application deadline: {result.school.application_deadline}</li>
                  </ul>
                  <div style={{ marginTop: '12px' }}>
                    <strong>Why this score?</strong>
                    <ul className="explanations-list">
                      {result.academicDetails.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="section-title">Personal Fit Breakdown</h3>
                  <ul className="breakdown-list">
                    <li>Region: {result.school.region}</li>
                    <li>Campus setting: {result.school.campus_setting}</li>
                    <li>Student life rating: {result.school.student_life_rating}/5</li>
                    <li>International students: {result.school.international_student_percent}%</li>
                    <li>Culture tags: {result.school.culture_tags.join(', ')}</li>
                    <li>
                      Tuition: {result.school.tuition_usd_per_year !== null ? `$${result.school.tuition_usd_per_year.toLocaleString()}` : 'Not available'}
                    </li>
                    <li>Data source: {result.school.data_source}</li>
                    <li>Last updated: {result.school.last_updated}</li>
                  </ul>
                  <div style={{ marginTop: '12px' }}>
                    <strong>Fit notes</strong>
                    <ul className="explanations-list">
                      {result.personalDetails.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h3 className="section-title">Major Fit</h3>
                <ul className="breakdown-list">
                  <li>{result.majorOffered ? `${preferences.major} is offered` : `${preferences.major} is not offered`}</li>
                  <li>Competitiveness: {result.majorCompetitiveness}</li>
                </ul>
                <div style={{ marginTop: '12px' }}>
                  <strong>Major fit notes</strong>
                  <ul className="explanations-list">
                    {result.majorFitDetails.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h3 className="section-title">Action Plan</h3>
                <ul className="actions-list">
                  {result.actionPlan.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

export default App;
