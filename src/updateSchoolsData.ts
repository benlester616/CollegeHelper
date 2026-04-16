import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { fetchCollegeData } from './collegeScorecard.js';

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

const dataFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'schools.json');

const loadCurrentSchools = async (): Promise<School[]> => {
  const payload = await readFile(dataFile, 'utf-8');
  return JSON.parse(payload) as School[];
};

const toSchoolRecord = (
  existing: School | null,
  patch: Exclude<Awaited<ReturnType<typeof fetchCollegeData>>, null>
): School => {
  const defaults: Partial<School> = {
    available_majors: existing?.available_majors ?? [],
    major_competitiveness: existing?.major_competitiveness ?? {},
    application_deadline: existing?.application_deadline ?? 'TBD',
    last_updated: new Date().toISOString().split('T')[0],
    data_source: 'College Scorecard API',
  };

  return {
    name: patch.name,
    region: 'US',
    location: patch.location,
    acceptance_rate: patch.acceptance_rate,
    avg_gpa: patch.avg_gpa,
    avg_sat: patch.avg_sat,
    tuition_usd_per_year: patch.tuition_usd_per_year,
    application_deadline: defaults.application_deadline as string,
    campus_setting: patch.campus_setting,
    international_student_percent: patch.international_student_percent,
    student_life_rating: patch.student_life_rating,
    culture_tags: patch.culture_tags,
    available_majors: defaults.available_majors as MajorCategory[],
    major_competitiveness: defaults.major_competitiveness as Partial<Record<MajorCategory, MajorCompetitiveness>>,
    last_updated: defaults.last_updated as string,
    data_source: defaults.data_source as string,
  };
};

export async function updateSchoolsData(schoolNames: string[]) {
  const existingSchools = await loadCurrentSchools();
  const updatedSchools = [...existingSchools];
  const errors: Record<string, string> = {};

  for (const schoolName of schoolNames) {
    const existing = existingSchools.find((school) => school.name.toLowerCase() === schoolName.trim().toLowerCase());

    if (existing && existing.region !== 'US') {
      errors[schoolName] = 'International school is not updated via College Scorecard API.';
      continue;
    }

    try {
      const apiData = await fetchCollegeData(schoolName);
      if (!apiData) {
        errors[schoolName] = 'Data unavailable for this school';
        continue;
      }

      const merged = toSchoolRecord(existing ?? null, apiData);
      const index = updatedSchools.findIndex((school) => school.name.toLowerCase() === merged.name.toLowerCase());
      if (index >= 0) {
        updatedSchools[index] = merged;
      } else {
        updatedSchools.push(merged);
      }
    } catch (error: unknown) {
      errors[schoolName] = 'Data unavailable for this school';
      console.error(`Failed to update ${schoolName}:`, error);
    }
  }

  await writeFile(dataFile, JSON.stringify(updatedSchools, null, 2));

  return { updatedSchools, errors };
}

if (process.argv.length > 2) {
  const schoolNames = process.argv.slice(2);
  updateSchoolsData(schoolNames)
    .then(({ updatedSchools, errors }) => {
      console.log('Update complete. Updated schools:', updatedSchools.map((school) => school.name));
      if (Object.keys(errors).length) {
        console.log('Errors:', errors);
      }
    })
    .catch((error) => {
      console.error('School update failed:', error);
      process.exit(1);
    });
}
