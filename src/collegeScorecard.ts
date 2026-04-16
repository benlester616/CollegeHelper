export type ScorecardApiResponse = {
  results: Array<{
    school: {
      name: string;
      city?: string;
      state?: string;
    };
    latest?: {
      admissions?: {
        admission_rate?: {
          overall?: number | null;
        };
        sat_scores?: {
          average?: {
            overall?: number | null;
          };
        };
      };
      cost?: {
        tuition?: {
          in_state?: number | null;
          out_of_state?: number | null;
        };
      };
      student?: {
        demographics?: {
          international?: number | null;
        };
      };
    };
  }>;
};

type SchoolPatch = {
  name: string;
  location: string;
  acceptance_rate: number | null;
  avg_sat: number | null;
  tuition_usd_per_year: number | null;
  avg_gpa: null;
  international_student_percent: number | null;
  campus_setting: 'urban' | 'suburban' | 'rural';
  student_life_rating: number;
  culture_tags: string[];
};

const SCORECARD_BASE_URL = 'https://api.data.gov/ed/collegescorecard/v1/schools';

const apiKey =
  typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined'
    ? (import.meta.env.VITE_COLLEGE_SCORECARD_API_KEY as string | undefined)
    : undefined;

const nodeApiKey = typeof process !== 'undefined' ? process.env.VITE_COLLEGE_SCORECARD_API_KEY : undefined;

const COLLEGE_SCORECARD_API_KEY = apiKey || nodeApiKey;

const normalizePercentage = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  if (value >= 0 && value <= 1) return Math.round(value * 100);
  return Math.round(value);
};

const inferCampusSetting = (location: string) => {
  const city = location.toLowerCase();
  if (city.includes('new york') || city.includes('los angeles') || city.includes('san francisco') || city.includes('chicago') || city.includes('boston') || city.includes('washington') || city.includes('philadelphia') || city.includes('houston') || city.includes('atlanta')) {
    return 'urban' as const;
  }
  if (city.includes('ann arbor') || city.includes('stanford') || city.includes('cambridge') || city.includes('berkeley') || city.includes('providence')) {
    return 'suburban' as const;
  }
  return 'suburban' as const;
};

export async function fetchCollegeData(schoolName: string): Promise<SchoolPatch | null> {
  if (!COLLEGE_SCORECARD_API_KEY) {
    throw new Error('College Scorecard API key is not configured. Set VITE_COLLEGE_SCORECARD_API_KEY in environment variables.');
  }

  const url = new URL(SCORECARD_BASE_URL);
  url.searchParams.set('api_key', COLLEGE_SCORECARD_API_KEY);
  url.searchParams.set('school.name', schoolName);
  url.searchParams.set(
    'fields',
    [
      'school.name',
      'school.city',
      'school.state',
      'latest.admissions.admission_rate.overall',
      'latest.admissions.sat_scores.average.overall',
      'latest.cost.tuition.in_state',
      'latest.cost.tuition.out_of_state',
      'latest.student.demographics.international',
    ].join(',')
  );

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`College Scorecard API request failed with status ${response.status}`);
  }

  const data = (await response.json()) as ScorecardApiResponse;
  if (!data?.results?.length) {
    return null;
  }

  const record = data.results[0];
  const locationParts = [record.school.city, record.school.state].filter(Boolean);

  return {
    name: record.school.name,
    location: locationParts.join(', '),
    acceptance_rate: normalizePercentage(record.latest?.admissions?.admission_rate?.overall),
    avg_sat: record.latest?.admissions?.sat_scores?.average?.overall ?? null,
    tuition_usd_per_year:
      record.latest?.cost?.tuition?.in_state ?? record.latest?.cost?.tuition?.out_of_state ?? null,
    avg_gpa: null,
    international_student_percent:
      normalizePercentage(record.latest?.student?.demographics?.international ?? null),
    campus_setting: inferCampusSetting(locationParts.join(', ')),
    student_life_rating: 3,
    culture_tags: [],
  };
}
