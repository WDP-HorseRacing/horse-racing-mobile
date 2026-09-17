# Stable OS

ROLE

You are a senior Product Designer, UX Architect, and UI Engineer specializing in premium SaaS products, sports performance platforms, veterinary management systems, IoT dashboards, and mobile-first applications.

Design a production-quality UI/UX concept for a product called:

RACEOS — Racehorse Training & Management System

Think like a combination of:

Apple Health

Garmin

Linear

Figma

modern professional racing/sports analytics platforms

The product must feel like a serious professional operating system for a racing stable, not a generic admin dashboard.

The system has 5 main user roles:

Head Trainer

Veterinarian

Groom / Stable Hand

Horse Owner

Club Manager

The same horse is the central object shared across the entire system, but every role should see different information and actions based on their responsibilities and RBAC permissions.

GOAL

Create a mobile-first UI/UX prototype for RACEOS.

The primary goal is to make the system feel:

Premium + Professional + Data-driven + Calm + High-stakes

The interface should help users quickly understand:

What is happening?

Which horse needs attention?

What should I do next?

Is the horse healthy?

Is the horse ready for training?

Is the horse ready for racing?

Is there an abnormal realtime sensor condition?

What action needs to happen now?

The most important end-to-end product flow is:

Trainer creates training plan
→ Groom receives and executes daily training
→ IoT sensors stream realtime data
→ System detects abnormal heart rate / speed / health signals
→ Veterinarian investigates
→ Veterinarian locks training if necessary
→ Trainer receives alert and adjusts the training plan
→ Groom receives updated schedule
→ Horse continues recovery/training
→ Owner monitors health, performance and race readiness

This flow should be visible in the overall UX architecture.

The design should prioritize decision-making and actionable information, not simply displaying data.

CONTEXT

Product concept

RACEOS is a digital operating system for a professional horse racing club.

The platform manages:

Racehorses

Training plans

Training sessions

Realtime IoT telemetry

Health and veterinary records

Injuries

Treatments

Feeding

Stable operations

Daily groom tasks

Racing schedules

Race results

Horse performance

Staff

Inventory

Finance

Reports

Notifications

Audit logs

RBAC permissions

The product should treat the Horse Profile as the central core object.

Every important action eventually connects back to a horse.

Design philosophy

Do NOT design this as a traditional enterprise CRUD application.

Avoid:

huge tables everywhere

excessive form fields

generic admin dashboards

excessive cards

cluttered sidebars

random colors

excessive gradients

excessive glassmorphism

neon UI

heavy shadows

decorative UI that does not provide information

Instead:

Use:

strong typography

generous whitespace

clean hierarchy

moderate rounded corners

beautiful charts

subtle borders

clear status indicators

minimal icons

calm animations

meaningful micro-interactions

excellent mobile ergonomics

data visualization

clear action hierarchy

Visual references:

Apple Health
for health and personal monitoring.

Garmin
for fitness, performance and realtime telemetry.

Linear
for professional SaaS structure, hierarchy and clean interaction design.

Figma
for information architecture and professional workspace behavior.

Horse Racing
for the emotional identity and high-stakes performance context.

Color system

Use a restrained professional palette.

Primary UI can support both:

Light Mode

warm white / neutral white background

dark charcoal text

subtle gray borders

restrained green accent

Dark Mode

deep charcoal / near-black background

off-white text

subtle dark borders

restrained green accent

Use status colors consistently:

FIT → green

MONITOR → amber/yellow

INJURED → red

LOCKED → black/dark

TRAINING → blue

RACE READY → purple

Status colors should communicate meaning, not decoration.

CONTENT

1. HEAD TRAINER EXPERIENCE

Mental model:

SEE HORSES → PLAN TRAINING → ASSIGN TRAINING → MONITOR LIVE → EVALUATE → SELECT RACE

Trainer mobile navigation

Bottom navigation:

Home

Horses

Training

Alerts

Profile

Trainer Home

Design a command-center style dashboard.

Show:

Stable fitness overview

Horses currently training

Today's training sessions

Horses requiring attention

Realtime alerts

Race-ready horses

Performance trend

Example:

Stable Fitness
78%

Training Today
12 horses

Attention Required
3 horses

Race Ready
5 horses

Show a compact fitness trend chart.

Trainer Horses

Horse list with:

Horse photo

Name

Status

Fitness

Weight

Current training phase

Last training session

Alert indicator

Allow search and filtering.

Filters:

All

Fit

Monitor

Injured

Training

Race Ready

Locked

Trainer Horse Profile

Sections:

Overview

Training

Health

Performance

Racing

Timeline

Overview should show:

Horse photo

Name

Age

Breed

Weight

Fitness score

Current status

Race readiness

Performance:

Speed chart

Heart-rate chart

Distance

Training load

Recovery trend

Training Plan

Allow trainer to create:

Training phase

Distance

Workload

Surface

Intensity

Schedule

Assigned Groom

Example:

Phase:
Base Conditioning

Distance:
1,600 m

Workload:
60–80%

Surface:
Dirt

Intensity:
Moderate

Include an easy-to-understand timeline/calendar.

2. GROOM / STABLE HAND EXPERIENCE

Mental model:

TODAY → SEE TASK → DO TASK → CHECK DONE → REPORT PROBLEM

This is the most important role for mobile usability.

The Groom should be able to operate the application with one hand while working around the stable.

Groom mobile navigation

Bottom navigation:

Home

Tasks

Stable

Report

Profile

Groom Home

Prioritize:

Today's Tasks

Show:

Feeding

Cleaning

Grooming

Bathing

Ice bath

Recovery care

Training preparation

Use large touch targets.

Each task should have:

Horse

Time

Task

Status

Complete button

Task interaction

Example:

06:00

Thunder King

Training preparation

1,600 m · Moderate

[Complete]

After completion:

Show a subtle success animation.

Stable Map

Create a simple visual stable layout.

Each stall shows:

Stall number

Horse

Status

Example:

A01 — Thunder King — FIT

A02 — Silver Arrow — MONITOR

A03 — Red Storm — LOCKED

Make the stable map visually understandable at a glance.

Incident Report

Create a fast mobile flow:

Report Incident

Select horse

Select incident:

Not eating

Fever signs

Colic signs

Hoof issue

Injury

Unusual behavior

Other

Allow:

Camera/photo

Short description

Severity

Submit

This must feel faster than filling out a traditional form.

3. IOT / REALTIME SENSOR EXPERIENCE

Realtime sensor data is one of the core differentiators of RACEOS.

Sensors may provide:

Heart rate

Speed

Distance

GPS

Temperature

Training duration

Create a realtime training screen.

Example:

Thunder King

LIVE TRAINING

Heart Rate
168 bpm

Speed
56 km/h

Distance
1.2 km

Temperature
38.2°C

Use beautiful realtime charts.

Charts should update smoothly.

Use subtle animation to communicate that data is live.

Do not use flashy neon effects.

Realtime abnormal condition

Create a high-priority alert state.

Example:

ABNORMAL CONDITION DETECTED

Thunder King

Heart rate exceeds configured safety threshold.

Show:

Current heart rate

Normal range

Speed

Training duration

Recent trend

Alert severity

Actions:

Review Horse

Contact Veterinarian

The UI should clearly communicate that this is a safety-critical situation.

4. VETERINARIAN EXPERIENCE

Mental model:

HORSE → EXAMINE → DIAGNOSE → TREAT → MONITOR → CLEAR / LOCK

Vet mobile navigation

Bottom navigation:

Home

Horses

Medical

Alerts

Profile

Vet Home

Show:

Health overview

Critical cases

Monitoring cases

Injured horses

Vaccination due

Deworming due

Farrier checks

Medical alerts

Use a clear health status map.

Horse Health Profile

Show:

Current health status

Weight

Vital signs

Medical history

Injuries

Treatment

Medication

Vaccinations

Farrier records

Medical Examination

Allow vet to record:

Examination

Symptoms

Diagnosis

Treatment

Medication

Notes

Follow-up date

Injury Mapping

Create a conceptual 3D horse anatomy interface.

The veterinarian should be able to select an area of the horse body and mark:

Injury location

Injury type

Severity

Date

Recovery status

Example:

Left hind leg

Status:
Monitoring

Recovery:
65%

Show recovery progress over time.

5. EMERGENCY TRAINING LOCK

This is one of the most important product interactions.

When a serious abnormality or injury is detected, the veterinarian can activate:

LOCK TRAINING

Show a clear confirmation interface.

Example:

LOCK TRAINING

Thunder King

Reason:
Abnormal heart-rate response

Impact:

Current training will be stopped

New heavy training cannot be assigned

Trainer will receive an alert

Groom will receive updated instructions

Horse status becomes LOCKED

Primary action:

Lock Training

Secondary:

Cancel

After locking:

Horse status:

🔒 LOCKED

Training status:

STOPPED

Create a visible system event in the horse timeline.

6. TRAINER ADJUSTMENT FLOW

After Vet locks training:

Trainer receives:

Critical Health Alert

Thunder King

Training has been locked by Veterinarian.

Reason:
Abnormal heart-rate response.

Actions:

View Health Report

Adjust Training Plan

Trainer opens the current training plan.

Show:

Previous plan

1,600 m
80% workload
Moderate intensity

Then allow trainer to create:

Recovery Plan

800 m
50% workload
Light intensity

Surface:
Soft

Start date:
Tomorrow

Add trainer note.

Then:

Update Training Plan

The Groom should automatically receive the new schedule.

This should demonstrate the power of connected workflows.

7. HORSE OWNER EXPERIENCE

Mental model:

MY HORSE → HEALTH → TRAINING → PERFORMANCE → RACING → MONEY

The Owner should not see unnecessary operational complexity.

Owner mobile navigation

Bottom navigation:

Home

Horses

Racing

Reports

Profile

Owner Home

Show:

My Horses

Example:

Thunder King
FIT

Fitness
82%

Race Readiness
High

Latest Training
1,200 m

Health
Stable

Upcoming Race
September 28

Owner Horse Profile

Show:

Horse identity

Pedigree

Health

Training

Performance

Racing

Media

Timeline

Performance

Use elegant charts:

Fitness trend

Speed trend

Training load

Race performance

Owner Reports

Show periodic summaries:

Training progress

Medical status

Maintenance costs

Training costs

Prize revenue

The owner experience should feel like tracking a professional athlete.

8. CLUB MANAGER EXPERIENCE

Mental model:

CLUB → PEOPLE → HORSES → OPERATIONS → FINANCE → REPORTS → AUDIT

Manager is the most enterprise-oriented role.

Manager mobile navigation

Bottom navigation:

Home

Horses

Operations

Reports

Profile

Manager Home

Show:

Club KPIs

Total horses

Active horses

Injured horses

Staff

Stable utilization

Operational costs

Race revenue

Use charts and trends rather than excessive tables.

Operations

Include:

Stable

Inventory

Staff

Inventory

Categories:

Feed

Medical supplies

Equipment

Show:

Current stock

Low stock

Recent transactions

Staff

Show:

Staff directory

Role

Status

Assigned responsibilities

RBAC

Manager can manage:

Roles

Permissions

User access

Audit Log

Show a clean timeline of important system actions:

Who

Action

Horse / Object

Time

Result

Example:

Veterinarian

Locked training

Thunder King

10:24

Critical health alert

9. SHARED HORSE PROFILE

The Horse is the central object of the product.

Every role should access the same underlying horse profile but see role-specific information and actions.

Horse Profile:

HORSE
│
├── Overview
├── Identity
├── Pedigree
├── Training
├── Health
├── Nutrition
├── Racing
├── Media
└── Timeline


The UI should make it obvious that these are different views of the same horse.

10. GLOBAL INFORMATION ARCHITECTURE

Create the following conceptual structure:

RACEOS
│
├── Dashboard
├── Horses
│   └── Horse Profile
│
├── Training
│   ├── Calendar
│   ├── Plans
│   ├── Live Training
│   └── Performance
│
├── Health
│   ├── Medical Records
│   ├── Injuries
│   ├── Treatment
│   ├── Vaccination
│   └── Veterinary Alerts
│
├── Stable
│   ├── Stable Map
│   ├── Tasks
│   ├── Feeding
│   └── Incidents
│
├── Racing
│   ├── Upcoming Races
│   ├── Entries
│   ├── Results
│   └── Revenue
│
├── Inventory
├── Finance
├── Staff
├── Reports
├── Notifications
├── Audit Logs
└── Settings


Navigation must dynamically change based on RBAC.

Do not expose irrelevant modules to each role.

11. IMPORTANT USER FLOW TO VISUALIZE

Create a visual end-to-end flow inside the prototype:

HEAD TRAINER
Create Training Plan
        ↓
GROOM
Receives Daily Schedule
        ↓
GROOM
Executes Training
        ↓
IOT SENSOR
Collects Realtime Data
        ↓
SYSTEM
Analyzes Heart Rate / Speed
        ↓
ABNORMAL CONDITION
Detected
        ↓
VETERINARIAN
Receives Critical Alert
        ↓
VETERINARIAN
Examines Horse
        ↓
VETERINARIAN
LOCK TRAINING
        ↓
SYSTEM
Notifies Trainer + Groom
        ↓
HEAD TRAINER
Adjusts Training Plan
        ↓
GROOM
Receives New Schedule
        ↓
IOT SENSOR
Continues Monitoring
        ↓
VETERINARIAN
Tracks Recovery
        ↓
SYSTEM
Updates Performance Data
        ↓
HORSE OWNER
Views Health + Performance + Race Readiness


This flow should feel like one connected ecosystem rather than separate applications.

12. RESPONSIVE / PLATFORM STRATEGY

The design must be MOBILE-FIRST.

The first priority is a smartphone interface.

Target mobile experience:

390px width

430px width

one-handed interaction

bottom navigation

large touch targets

swipe interactions where appropriate

sticky important actions

compact but readable charts

Do NOT simply shrink a desktop dashboard onto mobile.

Mobile and web should have different information density.

Mobile

Best for:

Groom

Trainer

Vet

quick alerts

realtime monitoring

task completion

incident reporting

quick horse lookup

Web

Later expand the same design system into React web for:

Trainer

Vet

Manager

Owner

Web can use:

sidebar navigation

multi-column dashboards

large charts

tables

calendar

analytics

reports

The mobile design system must therefore be scalable into a React web application.

13. COMPONENT SYSTEM

Create a reusable design system.

Components should include:

Status Badge

Horse Card

Horse Avatar

Metric Card

Health Indicator

Fitness Score

Realtime Chart

Performance Chart

Training Card

Training Timeline

Task Card

Alert Card

Medical Record Card

Injury Marker

Stable Stall Card

Race Card

Notification Item

Timeline Item

Bottom Navigation

Top App Bar

Search

Filter Chips

Bottom Sheet

Modal

Confirmation Dialog

Primary Button

Secondary Button

Empty State

Loading State

Error State

Use consistent spacing, typography, radius and interaction patterns.

14. DATA VISUALIZATION

Charts are important.

Use charts for:

Heart rate

Speed

Distance

Fitness

Training load

Recovery

Weight

Race performance

Stable utilization

Costs

Revenue

Charts must be:

minimal

readable

contextual

interactive where useful

responsive

animated subtly

Avoid decorative charts that do not communicate useful information.

15. ANIMATION

Use subtle professional animations.

Examples:

realtime chart updates

status transitions

task completion

notification appearance

bottom sheet transitions

page transitions

progress updates

Animation should communicate state changes.

Never use excessive bouncing, glowing, or flashy animations.

OUTPUT

Create a high-fidelity mobile-first UI/UX prototype for RACEOS.

Prioritize these screens first:

Phase 1 — Core mobile experience

Login

Role-based Home Dashboard

Horse List

Horse Profile

Training Plan

Daily Groom Tasks

Realtime Training

Critical Health Alert

Vet Medical Examination

Lock Training Confirmation

Trainer Adjust Training Plan

Owner Horse Performance

Phase 2 — Supporting experience

Stable Map

Feeding

Incident Report

Injury Mapping

Racing

Notifications

Reports

Manager Operations

Inventory

Staff / RBAC

Audit Logs

Start with the mobile experience, not desktop.

Create reusable components and a consistent design system so the same visual language can later be implemented in:

React Native for mobile

React for web

The prototype should feel like a real premium product that could be used by a professional racing stable.

Prioritize:

Clarity > Decoration

Actionability > Information overload

Data visualization > Generic tables

Professionalism > Visual effects

Safety-critical status > Decorative color

Mobile usability > Desktop conventions

The final design should communicate:

RACEOS is the operating system for a modern racing stable — connecting training, people, realtime sensors, veterinary care, racing performance and ownership into one calm, intelligent and trustworthy system.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/faf9137f-b245-4240-a201-63af80db307e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
