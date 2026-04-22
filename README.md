4/22/26 4:00PM
Bug fixes (from the schema drift audit)

Corrected all column name mismatches across the DB schema, crons, and frontend
Implemented the missing season_end scoring block in score-calculator
Fixed calculateNarrownessBonu typo, searchingStea typo, and the broken season join link

Season end snapshot system

Hourly cron now correctly derives peak_24h_player_count from the max of the last 24h of snapshots rather than just the current reading
Cron automatically detects expired active seasons and takes season_end snapshots
Manual admin button on the season detail page for recovery situations
Shared lib/season-snapshot.ts so both paths use identical logic

Season assignment

Admin games page now has an inline season dropdown per game row that saves instantly
