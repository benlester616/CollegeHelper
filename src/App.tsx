import { useMemo, useState } from 'react';
import schoolsData from './data/schools.json';

type School = {
  name: string;
  acceptance_rate: number;
  avg_gpa: number;
  avg_sat: number;
  application_deadline: string;
  tuition: number;
  location: string;
  campus_setting: 'urban' | 'suburban' | 'rural';
  international_student_percent: number;
  student_life_rating: number;
  culture_tags: string[];
};

type Preference = {
  gpa: number;
  sat: number | '';
  major: string;
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
  const gpaDiff = prefs.gpa - school.avg_gpa;
  const gpaScore = clamp(50 + gpaDiff * 20, 0, 100);
  const extraScore = prefs.extracurricular === 'high' ? 20 : prefs.extracurricular === 'medium' ? 10 : 0;

  if (prefs.sat === '') {
    return clamp(gpaScore * 0.7 + extraScore * 1.5, 0, 100);
  }

  const satDiff = prefs.sat - school.avg_sat;
  const satScore = clamp(50 + (satDiff / 150) * 20, 0, 100);
  return clamp(gpaScore * 0.5 + satScore * 0.3 + extraScore * 1, 0, 100);
};

const getAcademicClassification = (score: number) => {
  if (score >= 80) return 'Safety';
  if (score >= 50) return 'Target';
  return 'Reach';
};

const getAcademicDetails = (prefs: Preference, school: School) => {
  const messages: string[] = [];
  const gpaDiff = prefs.gpa - school.avg_gpa;
  if (gpaDiff >= 0) {
    messages.push(`Your GPA is ${gpaDiff.toFixed(2)} above the school average.`);
  } else {
    messages.push(`Your GPA is ${Math.abs(gpaDiff).toFixed(2)} below the school average.`);
  }

  if (prefs.sat === '') {
    messages.push('SAT score is not provided, so the evaluation relies on GPA and extracurricular strength.');
  } else {
    const satDiff = prefs.sat - school.avg_sat;
    if (satDiff >= 0) {
      messages.push(`Your SAT is ${satDiff} points above the average.`);
    } else {
      messages.push(`Your SAT is ${Math.abs(satDiff)} points below the average.`);
    }
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

const getPersonalFitScore = (prefs: Preference, school: School) => {
  let score = 0;

  if (prefs.campusSetting === school.campus_setting) {
    score += 20;
  }

  const socialDiff = Math.abs(mapSocialTarget(prefs.social) - school.student_life_rating);
  score += clamp(20 - socialDiff * 4, 0, 20);

  const diversityStrength = mapDiversityStrength(school.international_student_percent);
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

  if (school.tuition <= prefs.budget) {
    score += 15;
  } else if (school.tuition <= prefs.budget + 12000) {
    score += 6;
  }

  if (prefs.region === 'No preference') {
    score += 5;
  } else if (school.location.toLowerCase().includes(prefs.region.toLowerCase())) {
    score += 5;
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
  if (school.student_life_rating >= target) {
    messages.push(`Student life is rated ${school.student_life_rating}/5, aligned with your ${prefs.social} social preference.`);
  } else {
    messages.push(`Student life is rated ${school.student_life_rating}/5, which may feel quieter than your ${prefs.social} preference.`);
  }

  if (prefs.diversityImportance === 'high' && school.international_student_percent < 15) {
    messages.push(`International representation is ${school.international_student_percent}%, which is low for your high diversity preference.`);
  } else {
    messages.push(`International student share is ${school.international_student_percent}%, which supports your diversity preference.`);
  }

  if (school.culture_tags.includes(prefs.culturePreference) || prefs.culturePreference === 'mixed') {
    messages.push(`Culture tags (${school.culture_tags.join(', ')}) align well with your preference for ${prefs.culturePreference} culture.`);
  } else {
    messages.push(`Campus culture tags (${school.culture_tags.join(', ')}) are not a strong match for your ${prefs.culturePreference} preference.`);
  }

  if (school.tuition <= prefs.budget) {
    messages.push(`Tuition fits your budget at $${school.tuition.toLocaleString()} / year.`);
  } else {
    messages.push(`Tuition of $${school.tuition.toLocaleString()} exceeds your budget of $${prefs.budget.toLocaleString()}.`);
  }

  return messages;
};

const getActionPlan = (prefs: Preference, school: School, academicScore: number, fitScore: number) => {
  const actions: string[] = [];
  const isReach = academicScore < 50;
  const satGap = prefs.sat === '' ? null : school.avg_sat - prefs.sat;
  const gpaGap = school.avg_gpa - prefs.gpa;

  if (gpaGap > 0.1) {
    actions.push(`Strengthen GPA or academic narrative; you're ${gpaGap.toFixed(2)} below the average.`);
  }

  if (prefs.sat === '' || (satGap !== null && satGap > 40)) {
    actions.push('Improve your standardized test profile or submit additional academic evidence.');
  }

  if (prefs.extracurricular === 'low') {
    actions.push('Boost extracurricular impact by leading a project or adding a strong commitment example.');
  }

  if (school.tuition > prefs.budget) {
    actions.push('Research scholarships, aid, or lower-cost alternatives to make this option more affordable.');
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
    gpa: 3.5,
    sat: 1300,
    major: '',
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
        return {
          school,
          academicScore,
          personalFitScore,
          overallScore,
          classification: getAcademicClassification(academicScore),
          academicDetails: getAcademicDetails(preferences, school),
          personalDetails: getPersonalDetails(preferences, school),
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
              <input
                type="text"
                value={preferences.major}
                onChange={(event) => handlePreferenceChange('major', event.target.value)}
              />
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
                    <li>School average GPA: {result.school.avg_gpa.toFixed(2)}</li>
                    <li>School average SAT: {result.school.avg_sat}</li>
                    <li>Acceptance rate: {result.school.acceptance_rate}%</li>
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
                    <li>Campus setting: {result.school.campus_setting}</li>
                    <li>Student life rating: {result.school.student_life_rating}/5</li>
                    <li>International students: {result.school.international_student_percent}%</li>
                    <li>Culture tags: {result.school.culture_tags.join(', ')}</li>
                    <li>Tuition: ${result.school.tuition.toLocaleString()}</li>
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
