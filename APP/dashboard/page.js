'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const [leads, setLeads] = useState([])

  useEffect(() => {
    fetchLeads()
  }, [])

  async function fetchLeads() {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) {
      setLeads(data)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>SnowSkye AI Dashboard</h1>

      {leads.map((lead) => (
        <div key={lead.id} style={{ border: '1px solid #ccc', margin: 10, padding: 10 }}>
          <p><b>Name:</b> {lead.name}</p>
          <p><b>Message:</b> {lead.message}</p>
          <p><b>Date:</b> {lead.created_at}</p>
        </div>
      ))}
    </div>
  )
}
