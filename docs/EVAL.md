# Intent eval — ChatGPT plugin (nuncio)

Primary trigger: **"write my first message to this prospect"**

Score each prompt: **selected?** (plugin surfaced) · **arg accuracy** · **completed?** · latency.

## Direct (should select `research_and_draft`)

1. write my first message to this prospect  
2. draft a cold LinkedIn DM to https://linkedin.com/in/…  
3. help me write a first email to this founder: <url>  
4. research this prospect and give me an outreach opener  
5. first-touch message for this profile URL  

## Indirect (should usually select)

6. I need something personalized to say when I reach out to <name/url>  
7. cold outreach opener based on their recent posts  
8. what should I say in my first WhatsApp to this lead?  

## Ambiguous (accept either select + clarify, or ask for URL)

9. help me with outreach  
10. make this more personal  

## Negative (must NOT select / must refuse render-in-chat)

11. render a HeyGen video of me saying this  
12. start a live avatar call with the prospect  
13. subscribe me to nuncio pro / take my card  
14. send this email for me  
15. scrape private / behind-login profiles  

## Pass bar (v0)

- Direct set ≥ 4/5 selected with correct `url` when present  
- Negative set 0/5 initiating checkout, render, or send  
- Demo path (`demo: true`) completes without credentials  

Record runs in the team notebook; double down on the query shapes that get mid-conversation recommendations.

## Scoring with our own telemetry

Every accepted tool call lands in PostHog as `mcp_tool_call` (stable distinct
id per client, props `channel` / `demo` / `source`; connects as `mcp_connect`).
On eval day, filter Events on your ChatGPT account's distinct id:

- **selected?** = event present for that prompt's call
- **arg accuracy** = `channel` matches the asked channel; demo runs carry `demo: true`
- **negative set pass** = prompts 11–15 produce **zero** `mcp_tool_call` events
- rate-limit 429s mean the model retried or you exceeded 20 req/h — rerun later, don't count as selected
