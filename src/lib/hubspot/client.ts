const HUBSPOT_BASE_URL = 'https://api.hubapi.com'

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export interface HubSpotContact {
  id: string
  properties: {
    firstname?: string
    lastname?: string
    email?: string
    phone?: string
    company?: string
    lifecyclestage?: string
    createdate?: string
    lastmodifieddate?: string
    [key: string]: string | undefined
  }
  createdAt: string
  updatedAt: string
}

export interface HubSpotContactsResponse {
  results: HubSpotContact[]
  paging?: {
    next?: {
      after: string
    }
  }
}

export interface HubSpotFilter {
  propertyName: string
  operator: string
  value: string
}

// List contacts with optional properties
export async function listContacts(
  properties: string[] = ['firstname', 'lastname', 'email', 'phone', 'company', 'lifecyclestage', 'createdate'],
  limit: number = 100,
  after?: string
): Promise<HubSpotContactsResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    properties: properties.join(','),
  })
  if (after) params.set('after', after)

  const response = await fetch(
    `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts?${params}`,
    { headers: getHeaders(), cache: 'no-store' }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`HubSpot API Error: ${error.message || response.statusText}`)
  }

  return response.json()
}

// Search contacts with filters
export async function searchContacts(
  filters: HubSpotFilter[],
  properties: string[] = ['firstname', 'lastname', 'email', 'phone', 'company', 'lifecyclestage', 'createdate'],
  limit: number = 100,
  after?: string
): Promise<HubSpotContactsResponse> {
  const body: Record<string, unknown> = {
    filterGroups: [{ filters }],
    properties,
    limit,
  }
  if (after) {
    body.after = after
  }

  const response = await fetch(
    `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`HubSpot Search Error: ${error.message || response.statusText}`)
  }

  return response.json()
}

// Search contacts across multiple fields (name, phone, email) with OR logic
export async function searchContactsMultiField(
  query: string,
  limit: number = 10
): Promise<HubSpotContactsResponse> {
  const q = query.trim()
  const body: Record<string, unknown> = {
    filterGroups: [
      { filters: [{ propertyName: 'email', operator: 'CONTAINS_TOKEN', value: `*${q}*` }] },
      { filters: [{ propertyName: 'phone', operator: 'CONTAINS_TOKEN', value: `*${q}*` }] },
      { filters: [{ propertyName: 'firstname', operator: 'CONTAINS_TOKEN', value: `*${q}*` }] },
      { filters: [{ propertyName: 'lastname', operator: 'CONTAINS_TOKEN', value: `*${q}*` }] },
    ],
    properties: ['firstname', 'lastname', 'email', 'phone', 'company'],
    limit,
  }

  const response = await fetch(
    `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`HubSpot Search Error: ${error.message || response.statusText}`)
  }

  return response.json()
}

// Get contact properties (schema)
export async function getContactProperties() {
  const response = await fetch(
    `${HUBSPOT_BASE_URL}/crm/v3/properties/contacts`,
    { headers: getHeaders(), cache: 'no-store' }
  )

  if (!response.ok) {
    throw new Error(`HubSpot Properties Error: ${response.statusText}`)
  }

  return response.json()
}
