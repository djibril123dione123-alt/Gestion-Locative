-- ==============================================================================
-- SAMAY KËUR — PRICING & TRIAL HARDENING
-- Objectif: Aligner la BDD avec la politique commerciale publique et les 30 jours d'essai.
-- ==============================================================================

-- 1. Mise à jour des durées de Trial
-- On force l'essai gratuit (plan basic) à 30 jours (pour corriger les 14j précédents)
UPDATE subscription_plans 
SET features = jsonb_set(features, '{trial_days}', '30'::jsonb)
WHERE id = 'basic';

-- 2. Mise à jour des prix publics (Pro et Business)
-- Pro: 15 000 public, 12 000 founder
UPDATE subscription_plans 
SET price_xof = 15000, 
    founder_price_xof = 12000 
WHERE id = 'pro';

-- Business: 35 000 public, 29 000 founder
UPDATE subscription_plans 
SET price_xof = 35000, 
    founder_price_xof = 29000 
WHERE id = 'business';

-- 3. Suppression du plan "starter" s'il existait en DB 
-- (Si une subscription pointe encore dessus, la FK peut poser problème, 
--  mais starter ne semble pas avoir été inséré dans les migrations précédentes)
DELETE FROM subscription_plans WHERE id = 'starter';
