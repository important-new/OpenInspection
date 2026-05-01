-- Phase T+1: Seed ~60 default Comment Library entries per tenant.
-- Inspector eval flagged the empty Comments Library as the #1 efficiency
-- short-coming vs Spectora (200+ default comments) and ITB (100+).
-- Idempotent: skips inserting any text+category that already exists for the
-- tenant, so re-running the migration after a manual edit is safe.

INSERT INTO comments (id, tenant_id, text, category, created_at)
SELECT lower(hex(randomblob(16))), t.id, x.text, x.category, unixepoch('now')
FROM tenants t
CROSS JOIN (
  -- Roof
  SELECT 'Roof shingles show granule loss; recommend a qualified roofer evaluate remaining service life.' AS text, 'Roof' AS category UNION ALL
  SELECT 'Active leak observed at roof penetration; recommend repair to prevent interior water damage.', 'Roof' UNION ALL
  SELECT 'Flashing at chimney/skylight/wall is deteriorated; recommend re-flashing.', 'Roof' UNION ALL
  SELECT 'Roof valley is showing wear and exposed nail heads; recommend repair.', 'Roof' UNION ALL
  SELECT 'Gutter is detached/sagging and not directing water away from foundation; recommend repair.', 'Roof' UNION ALL
  SELECT 'Downspout discharges within 5 feet of foundation; recommend extending discharge.', 'Roof' UNION ALL
  SELECT 'Tree branches overhang the roof; recommend trimming to prevent abrasion and debris.', 'Roof' UNION ALL
  -- Exterior
  SELECT 'Exterior caulking around windows/doors is cracked; recommend re-caulking to prevent water intrusion.', 'Exterior' UNION ALL
  SELECT 'Siding shows damage/missing pieces; recommend repair to maintain weather barrier.', 'Exterior' UNION ALL
  SELECT 'Wood trim shows rot/decay; recommend replacement and repaint.', 'Exterior' UNION ALL
  SELECT 'Grading slopes toward foundation; recommend regrading to direct water away.', 'Exterior' UNION ALL
  SELECT 'Deck/porch railing is loose or below code height; recommend correction for safety.', 'Exterior' UNION ALL
  SELECT 'Vegetation in contact with siding traps moisture; recommend trimming back.', 'Exterior' UNION ALL
  SELECT 'Cracked/missing concrete in driveway/walkway presents trip hazard; recommend repair.', 'Exterior' UNION ALL
  -- Electrical
  SELECT 'GFCI protection is missing in kitchen/bathroom/exterior receptacles; recommend installation per current code.', 'Electrical' UNION ALL
  SELECT 'Receptacle is wired with reverse polarity; recommend correction by qualified electrician.', 'Electrical' UNION ALL
  SELECT 'Open ground detected at receptacle; recommend correction by qualified electrician.', 'Electrical' UNION ALL
  SELECT 'Electrical panel has double-tapped breaker(s); recommend evaluation by qualified electrician.', 'Electrical' UNION ALL
  SELECT 'Knob-and-tube wiring observed; recommend evaluation for replacement and insurance implications.', 'Electrical' UNION ALL
  SELECT 'Federal Pacific/Zinsco panel observed; recommend evaluation by qualified electrician (known reliability concerns).', 'Electrical' UNION ALL
  SELECT 'Smoke detector missing/non-functional in required location; recommend installation.', 'Electrical' UNION ALL
  SELECT 'Carbon monoxide detector missing; recommend installation per current code.', 'Electrical' UNION ALL
  -- Plumbing
  SELECT 'Active leak observed at supply line/drain; recommend prompt repair by qualified plumber.', 'Plumbing' UNION ALL
  SELECT 'Galvanized supply piping observed; recommend evaluation due to corrosion and reduced flow with age.', 'Plumbing' UNION ALL
  SELECT 'Polybutylene piping observed; recommend evaluation due to known failure history.', 'Plumbing' UNION ALL
  SELECT 'Water heater shows visible corrosion at tank; recommend evaluation for remaining life.', 'Plumbing' UNION ALL
  SELECT 'Water heater TPR valve discharge pipe is missing/improperly terminated; recommend correction.', 'Plumbing' UNION ALL
  SELECT 'Water heater straps missing in seismic zone; recommend installation.', 'Plumbing' UNION ALL
  SELECT 'Toilet is loose at floor flange; recommend reseat and replace wax ring.', 'Plumbing' UNION ALL
  SELECT 'Drain stoppage observed; recommend clearing by qualified plumber.', 'Plumbing' UNION ALL
  SELECT 'P-trap missing/improperly configured under sink; recommend correction.', 'Plumbing' UNION ALL
  -- HVAC
  SELECT 'HVAC system age exceeds typical service life (15-20 years); recommend budgeting for replacement.', 'HVAC' UNION ALL
  SELECT 'Furnace filter is dirty; recommend replacement and a regular replacement schedule.', 'HVAC' UNION ALL
  SELECT 'AC condenser unit is unlevel/sinking; recommend leveling.', 'HVAC' UNION ALL
  SELECT 'Insufficient cooling differential measured; recommend evaluation by HVAC technician.', 'HVAC' UNION ALL
  SELECT 'Furnace flue/vent shows corrosion or improper slope; recommend evaluation.', 'HVAC' UNION ALL
  SELECT 'Ductwork is disconnected/uninsulated in unconditioned space; recommend correction.', 'HVAC' UNION ALL
  SELECT 'Combustion air supply to furnace appears insufficient; recommend evaluation.', 'HVAC' UNION ALL
  -- Interior
  SELECT 'Drywall cracks observed; appear to be normal settling but recommend monitoring.', 'Interior' UNION ALL
  SELECT 'Window seal failure (fogging between panes) observed; recommend glass replacement.', 'Interior' UNION ALL
  SELECT 'Window/door does not operate smoothly; recommend adjustment.', 'Interior' UNION ALL
  SELECT 'Floor covering shows damage/wear that may warrant replacement.', 'Interior' UNION ALL
  SELECT 'Stair railing is loose or below code height; recommend correction for safety.', 'Interior' UNION ALL
  -- Kitchen
  SELECT 'Dishwasher air gap missing or improperly installed; recommend correction per code.', 'Kitchen' UNION ALL
  SELECT 'Range anti-tip bracket missing; recommend installation per manufacturer.', 'Kitchen' UNION ALL
  SELECT 'Garbage disposal leaks at body/connections; recommend repair or replacement.', 'Kitchen' UNION ALL
  SELECT 'Range hood does not vent to exterior; recommend evaluation.', 'Kitchen' UNION ALL
  -- Bathroom
  SELECT 'Bathroom exhaust fan does not vent to exterior; recommend correction.', 'Bathroom' UNION ALL
  SELECT 'Caulking at tub/shower/toilet base is deteriorated; recommend re-caulking.', 'Bathroom' UNION ALL
  SELECT 'Tile grout is cracked/missing; recommend regrouting to prevent water damage.', 'Bathroom' UNION ALL
  SELECT 'Slow drain in tub/sink/shower; recommend clearing by qualified plumber.', 'Bathroom' UNION ALL
  -- Garage
  SELECT 'Garage door auto-reverse safety did not function on test; recommend service by qualified technician.', 'Garage' UNION ALL
  SELECT 'Photo-eye sensors on garage door missing/misaligned; recommend correction.', 'Garage' UNION ALL
  SELECT 'Door from garage to interior is not fire-rated/self-closing; recommend correction per code.', 'Garage' UNION ALL
  -- Foundation / Basement
  SELECT 'Foundation cracks observed; appear cosmetic but recommend monitoring for movement.', 'Foundation' UNION ALL
  SELECT 'Efflorescence on foundation walls indicates past moisture intrusion; recommend evaluation.', 'Foundation' UNION ALL
  SELECT 'Sump pump did not activate on test; recommend service.', 'Foundation' UNION ALL
  SELECT 'Crawlspace vapor barrier missing/incomplete; recommend installation.', 'Foundation' UNION ALL
  -- Safety
  SELECT 'Handrail required on stairs with 4+ risers; missing/incomplete in this area.', 'Safety' UNION ALL
  SELECT 'Tempered glass required at hazardous locations (within 24" of door, near tub/shower); appears non-tempered.', 'Safety' UNION ALL
  SELECT 'Fireplace damper is rusted/inoperable; recommend service before use.', 'Safety'
) AS x
WHERE NOT EXISTS (
  SELECT 1 FROM comments c WHERE c.tenant_id = t.id AND c.text = x.text
);
