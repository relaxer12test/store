# Northstar Supply Restock Reorder Playbook

## Overview

Use this playbook for Northstar Supply items when a reorder decision is needed for a low-stock SKU.

## When to Reorder

Reorder when on-hand stock drops below 12 units or when projected cover is fewer than 21 days.

## Target Cover

Calculate replenishment to 45 days of cover.

## Required Inputs

- SKU
- On-hand units
- 30-day sales
- Open PO status
- Last vendor ETA

## Steps

- verify on-hand and open POs
- calculate reorder quantity to 45 days of cover
- draft PO
- confirm ETA with Northstar
- notify ops lead after PO draft

## Escalate When

- escalate when stock is below 7 units
- escalate when ETA slips by more than 3 days
- do not promise ship dates before ETA is confirmed

## Contacts

- Vendor owner: Northstar Supply purchasing desk
- Ops owner: Ops lead on duty
