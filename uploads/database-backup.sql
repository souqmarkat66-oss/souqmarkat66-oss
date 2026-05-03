--
-- PostgreSQL database dump
--

\restrict oWD4EJcHkCNdEHDeZ2vsapaMIwATjb1Ryuh4Oui8MjhfOtajefRqxF5b4TBYkeT

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ad_campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ad_campaigns (
    id integer NOT NULL,
    advertiser_id character varying NOT NULL,
    name text NOT NULL,
    description text,
    media_url text,
    media_type text DEFAULT 'image'::text,
    target_url text,
    target_languages text[],
    target_categories text[],
    budget real DEFAULT 0,
    spent real DEFAULT 0,
    cpm_rate real DEFAULT 5,
    publisher_rev_share real DEFAULT 0.6,
    impressions integer DEFAULT 0,
    clicks integer DEFAULT 0,
    status text DEFAULT 'pending'::text,
    embed_code text,
    created_at timestamp without time zone DEFAULT now(),
    target_regions text[],
    target_age_min integer,
    target_age_max integer,
    budget_egp real DEFAULT 0,
    spent_egp real DEFAULT 0,
    cpm_rate_egp real DEFAULT 15,
    click_tracking_code text
);


ALTER TABLE public.ad_campaigns OWNER TO postgres;

--
-- Name: ad_campaigns_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ad_campaigns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ad_campaigns_id_seq OWNER TO postgres;

--
-- Name: ad_campaigns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ad_campaigns_id_seq OWNED BY public.ad_campaigns.id;


--
-- Name: ad_impressions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ad_impressions (
    id integer NOT NULL,
    campaign_id integer,
    channel_id integer,
    user_id character varying(255),
    ip_address text,
    user_agent text,
    event_type text DEFAULT 'impression'::text,
    is_fraud boolean DEFAULT false,
    fraud_reason text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.ad_impressions OWNER TO postgres;

--
-- Name: ad_impressions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ad_impressions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ad_impressions_id_seq OWNER TO postgres;

--
-- Name: ad_impressions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ad_impressions_id_seq OWNED BY public.ad_impressions.id;


--
-- Name: ad_link_clicks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ad_link_clicks (
    id integer NOT NULL,
    ad_id integer NOT NULL,
    link_type text NOT NULL,
    dest_url text,
    ip character varying(60),
    user_agent text,
    user_id character varying(100),
    is_fraud boolean DEFAULT false,
    fraud_reason text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.ad_link_clicks OWNER TO postgres;

--
-- Name: ad_link_clicks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ad_link_clicks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ad_link_clicks_id_seq OWNER TO postgres;

--
-- Name: ad_link_clicks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ad_link_clicks_id_seq OWNED BY public.ad_link_clicks.id;


--
-- Name: admin_activity_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_activity_log (
    id integer NOT NULL,
    admin_id character varying,
    action text,
    target text,
    details text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.admin_activity_log OWNER TO postgres;

--
-- Name: admin_activity_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_activity_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_activity_log_id_seq OWNER TO postgres;

--
-- Name: admin_activity_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_activity_log_id_seq OWNED BY public.admin_activity_log.id;


--
-- Name: ads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ads (
    id integer NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    media_url text NOT NULL,
    media_type text NOT NULL,
    language text DEFAULT 'ar'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    user_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    likes_count integer DEFAULT 0,
    comments_count integer DEFAULT 0,
    views_count integer DEFAULT 0,
    target_region text,
    price_egp numeric(10,2),
    whatsapp_number character varying(20),
    payment_link text,
    app_store_url text,
    google_play_url text,
    app_gallery_url text,
    installment_months integer,
    installment_monthly_egp real,
    target_lat real,
    target_lng real,
    target_radius_km real,
    expires_at timestamp without time zone,
    target_interests text,
    target_ages text,
    whatsapp_clicks integer DEFAULT 0,
    is_boosted boolean DEFAULT false,
    boosted_until timestamp without time zone,
    coupon_code text,
    coupon_discount_type text,
    coupon_discount_value real,
    is_admin_promo boolean DEFAULT false
);


ALTER TABLE public.ads OWNER TO postgres;

--
-- Name: ads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ads_id_seq OWNER TO postgres;

--
-- Name: ads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ads_id_seq OWNED BY public.ads.id;


--
-- Name: ai_usage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_usage (
    id integer NOT NULL,
    user_id character varying,
    type text NOT NULL,
    credits_used integer DEFAULT 1,
    cost real DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.ai_usage OWNER TO postgres;

--
-- Name: ai_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ai_usage_id_seq OWNER TO postgres;

--
-- Name: ai_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_usage_id_seq OWNED BY public.ai_usage.id;


--
-- Name: boost_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.boost_orders (
    id integer NOT NULL,
    order_number character varying NOT NULL,
    ad_id integer NOT NULL,
    user_id character varying NOT NULL,
    amount numeric(10,2) DEFAULT 0 NOT NULL,
    payment_ref character varying NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    payment_screenshot_url text,
    payment_method text
);


ALTER TABLE public.boost_orders OWNER TO postgres;

--
-- Name: boost_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.boost_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.boost_orders_id_seq OWNER TO postgres;

--
-- Name: boost_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.boost_orders_id_seq OWNED BY public.boost_orders.id;


--
-- Name: channel_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.channel_subscriptions (
    id integer NOT NULL,
    user_id text NOT NULL,
    channel_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.channel_subscriptions OWNER TO postgres;

--
-- Name: channel_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.channel_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.channel_subscriptions_id_seq OWNER TO postgres;

--
-- Name: channel_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.channel_subscriptions_id_seq OWNED BY public.channel_subscriptions.id;


--
-- Name: channels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.channels (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    name text NOT NULL,
    description text,
    avatar_url text,
    banner_url text,
    language text DEFAULT 'ar'::text,
    category text DEFAULT 'general'::text,
    subscriber_count integer DEFAULT 0,
    views_count integer DEFAULT 0,
    is_verified boolean DEFAULT false,
    is_monetized boolean DEFAULT false,
    status text DEFAULT 'active'::text,
    earnings real DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    earnings_egp real DEFAULT 0,
    wallet_number text,
    wallet_type text,
    publisher_code text
);


ALTER TABLE public.channels OWNER TO postgres;

--
-- Name: channels_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.channels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.channels_id_seq OWNER TO postgres;

--
-- Name: channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.channels_id_seq OWNED BY public.channels.id;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    stream_id integer NOT NULL,
    user_id character varying NOT NULL,
    user_name text NOT NULL,
    message text NOT NULL,
    is_hidden boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    is_voice boolean DEFAULT false
);


ALTER TABLE public.chat_messages OWNER TO postgres;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_messages_id_seq OWNER TO postgres;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: coin_packages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coin_packages (
    id integer NOT NULL,
    name text NOT NULL,
    coins integer NOT NULL,
    price_egp real NOT NULL,
    bonus_coins integer DEFAULT 0,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.coin_packages OWNER TO postgres;

--
-- Name: coin_packages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.coin_packages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.coin_packages_id_seq OWNER TO postgres;

--
-- Name: coin_packages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.coin_packages_id_seq OWNED BY public.coin_packages.id;


--
-- Name: coin_purchase_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coin_purchase_orders (
    id integer NOT NULL,
    user_id text NOT NULL,
    user_name text,
    package_id integer,
    coins integer NOT NULL,
    amount_egp numeric(10,2) NOT NULL,
    payment_method text NOT NULL,
    payment_ref text,
    screenshot_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_note text,
    created_at timestamp without time zone DEFAULT now(),
    reviewed_at timestamp without time zone,
    reviewed_by text
);


ALTER TABLE public.coin_purchase_orders OWNER TO postgres;

--
-- Name: coin_purchase_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.coin_purchase_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.coin_purchase_orders_id_seq OWNER TO postgres;

--
-- Name: coin_purchase_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.coin_purchase_orders_id_seq OWNED BY public.coin_purchase_orders.id;


--
-- Name: coin_recharge_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coin_recharge_codes (
    id integer NOT NULL,
    code text NOT NULL,
    coins integer NOT NULL,
    price_egp real NOT NULL,
    used_by_user_id character varying,
    used_at timestamp without time zone,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.coin_recharge_codes OWNER TO postgres;

--
-- Name: coin_recharge_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.coin_recharge_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.coin_recharge_codes_id_seq OWNER TO postgres;

--
-- Name: coin_recharge_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.coin_recharge_codes_id_seq OWNED BY public.coin_recharge_codes.id;


--
-- Name: coin_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coin_transactions (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    type text NOT NULL,
    coins integer NOT NULL,
    description text,
    related_stream_id integer,
    related_user_id character varying,
    recharge_code_id integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.coin_transactions OWNER TO postgres;

--
-- Name: coin_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.coin_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.coin_transactions_id_seq OWNER TO postgres;

--
-- Name: coin_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.coin_transactions_id_seq OWNED BY public.coin_transactions.id;


--
-- Name: coin_wallets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coin_wallets (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    balance integer DEFAULT 0 NOT NULL,
    total_spent integer DEFAULT 0 NOT NULL,
    total_earned integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.coin_wallets OWNER TO postgres;

--
-- Name: coin_wallets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.coin_wallets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.coin_wallets_id_seq OWNER TO postgres;

--
-- Name: coin_wallets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.coin_wallets_id_seq OWNED BY public.coin_wallets.id;


--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    user_name text NOT NULL,
    target_type text NOT NULL,
    target_id integer NOT NULL,
    content text NOT NULL,
    likes_count integer DEFAULT 0,
    is_hidden boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    is_voice_comment boolean DEFAULT false,
    voice_text text,
    is_voice boolean DEFAULT false
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comments_id_seq OWNER TO postgres;

--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;


--
-- Name: consultations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.consultations (
    id integer NOT NULL,
    user_id text NOT NULL,
    user_name text,
    package_id text NOT NULL,
    package_label text,
    amount_egp numeric(10,2) DEFAULT 0,
    title text NOT NULL,
    description text,
    file_urls text,
    status text DEFAULT 'pending'::text,
    admin_note text,
    reply text,
    payment_ref text,
    payment_method text,
    payment_screenshot_url text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.consultations OWNER TO postgres;

--
-- Name: consultations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.consultations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.consultations_id_seq OWNER TO postgres;

--
-- Name: consultations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.consultations_id_seq OWNED BY public.consultations.id;


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id integer NOT NULL,
    title text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversations_id_seq OWNER TO postgres;

--
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coupons (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    business_name text DEFAULT ''::text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    code text NOT NULL,
    discount_type text DEFAULT 'percentage'::text,
    discount_value real,
    image_url text,
    description text,
    terms_ar text,
    is_active boolean DEFAULT true,
    expires_at timestamp without time zone,
    usage_limit integer,
    used_count integer DEFAULT 0,
    amount_paid_egp real DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.coupons OWNER TO postgres;

--
-- Name: coupons_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.coupons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.coupons_id_seq OWNER TO postgres;

--
-- Name: coupons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.coupons_id_seq OWNED BY public.coupons.id;


--
-- Name: direct_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.direct_messages (
    id integer NOT NULL,
    from_user_id character varying NOT NULL,
    to_user_id character varying NOT NULL,
    ad_id integer,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    is_voice boolean DEFAULT false,
    voice_url text,
    image_url text,
    is_payment_proof boolean DEFAULT false,
    reply_to_id integer,
    reply_to_text text
);


ALTER TABLE public.direct_messages OWNER TO postgres;

--
-- Name: direct_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.direct_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.direct_messages_id_seq OWNER TO postgres;

--
-- Name: direct_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.direct_messages_id_seq OWNED BY public.direct_messages.id;


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.favorites (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    ad_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.favorites OWNER TO postgres;

--
-- Name: favorites_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.favorites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.favorites_id_seq OWNER TO postgres;

--
-- Name: favorites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.favorites_id_seq OWNED BY public.favorites.id;


--
-- Name: follows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.follows (
    id integer NOT NULL,
    follower_id character varying NOT NULL,
    channel_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.follows OWNER TO postgres;

--
-- Name: follows_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.follows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.follows_id_seq OWNER TO postgres;

--
-- Name: follows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.follows_id_seq OWNED BY public.follows.id;


--
-- Name: fraud_alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fraud_alerts (
    id integer NOT NULL,
    campaign_id integer,
    ip_address text,
    alert_type text,
    details text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.fraud_alerts OWNER TO postgres;

--
-- Name: fraud_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.fraud_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fraud_alerts_id_seq OWNER TO postgres;

--
-- Name: fraud_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.fraud_alerts_id_seq OWNED BY public.fraud_alerts.id;


--
-- Name: likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.likes (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    target_type text NOT NULL,
    target_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.likes OWNER TO postgres;

--
-- Name: likes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.likes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.likes_id_seq OWNER TO postgres;

--
-- Name: likes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.likes_id_seq OWNED BY public.likes.id;


--
-- Name: live_streams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.live_streams (
    id integer NOT NULL,
    channel_id integer NOT NULL,
    user_id character varying NOT NULL,
    title text NOT NULL,
    description text,
    thumbnail_url text,
    category text DEFAULT 'general'::text,
    language text DEFAULT 'ar'::text,
    status text DEFAULT 'scheduled'::text,
    viewer_count integer DEFAULT 0,
    peak_viewers integer DEFAULT 0,
    likes_count integer DEFAULT 0,
    chat_enabled boolean DEFAULT true,
    started_at timestamp without time zone,
    ended_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    show_ads boolean DEFAULT true,
    total_earnings_egp real DEFAULT 0,
    recording_url text,
    stream_key text,
    stream_mode text DEFAULT 'webrtc'::text
);


ALTER TABLE public.live_streams OWNER TO postgres;

--
-- Name: live_streams_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.live_streams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.live_streams_id_seq OWNER TO postgres;

--
-- Name: live_streams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.live_streams_id_seq OWNED BY public.live_streams.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.messages_id_seq OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    link text,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    voice_url text,
    sender_user_id character varying
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: offers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.offers (
    id integer NOT NULL,
    from_user_id character varying NOT NULL,
    from_user_name text NOT NULL,
    ad_id integer NOT NULL,
    offer_amount_egp real NOT NULL,
    message text,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.offers OWNER TO postgres;

--
-- Name: offers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.offers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.offers_id_seq OWNER TO postgres;

--
-- Name: offers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.offers_id_seq OWNED BY public.offers.id;


--
-- Name: payment_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_notifications (
    id integer NOT NULL,
    ad_id integer,
    payer_name text NOT NULL,
    payer_phone character varying(20) NOT NULL,
    paid_amount numeric(10,2) NOT NULL,
    payment_method text NOT NULL,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT now(),
    screenshot_url text,
    payer_user_id character varying(100)
);


ALTER TABLE public.payment_notifications OWNER TO postgres;

--
-- Name: payment_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_notifications_id_seq OWNER TO postgres;

--
-- Name: payment_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_notifications_id_seq OWNED BY public.payment_notifications.id;


--
-- Name: payment_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_requests (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    type text NOT NULL,
    amount_egp real NOT NULL,
    method text NOT NULL,
    phone_number text,
    status text DEFAULT 'pending'::text,
    admin_note text,
    created_at timestamp without time zone DEFAULT now(),
    order_number text,
    ad_id integer,
    screenshot_url text,
    service_type text,
    payment_ref text,
    national_id text,
    card_number text
);


ALTER TABLE public.payment_requests OWNER TO postgres;

--
-- Name: payment_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_requests_id_seq OWNER TO postgres;

--
-- Name: payment_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_requests_id_seq OWNED BY public.payment_requests.id;


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.platform_settings (
    id integer NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.platform_settings OWNER TO postgres;

--
-- Name: platform_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.platform_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.platform_settings_id_seq OWNER TO postgres;

--
-- Name: platform_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.platform_settings_id_seq OWNED BY public.platform_settings.id;


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.push_subscriptions (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.push_subscriptions OWNER TO postgres;

--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.push_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.push_subscriptions_id_seq OWNER TO postgres;

--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.push_subscriptions_id_seq OWNED BY public.push_subscriptions.id;


--
-- Name: ratings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ratings (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    user_name text NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    rating integer NOT NULL,
    review text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.ratings OWNER TO postgres;

--
-- Name: ratings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ratings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ratings_id_seq OWNER TO postgres;

--
-- Name: ratings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ratings_id_seq OWNED BY public.ratings.id;


--
-- Name: reels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reels (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    channel_id integer,
    title text NOT NULL,
    description text,
    video_url text NOT NULL,
    thumbnail_url text,
    duration integer DEFAULT 30,
    views_count integer DEFAULT 0,
    likes_count integer DEFAULT 0,
    comments_count integer DEFAULT 0,
    status text DEFAULT 'active'::text,
    created_at timestamp without time zone DEFAULT now(),
    is_voice_comment boolean DEFAULT false,
    audio_url text
);


ALTER TABLE public.reels OWNER TO postgres;

--
-- Name: reels_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reels_id_seq OWNER TO postgres;

--
-- Name: reels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reels_id_seq OWNED BY public.reels.id;


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.referrals (
    id integer NOT NULL,
    referrer_id character varying NOT NULL,
    referred_id character varying NOT NULL,
    bonus_egp numeric(10,2) DEFAULT 5,
    status character varying DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.referrals OWNER TO postgres;

--
-- Name: referrals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.referrals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.referrals_id_seq OWNER TO postgres;

--
-- Name: referrals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.referrals_id_seq OWNED BY public.referrals.id;


--
-- Name: renewal_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.renewal_orders (
    id integer NOT NULL,
    order_number character varying NOT NULL,
    ad_id integer NOT NULL,
    user_id character varying NOT NULL,
    duration_days integer DEFAULT 30 NOT NULL,
    amount numeric(10,2) DEFAULT 0 NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.renewal_orders OWNER TO postgres;

--
-- Name: renewal_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.renewal_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.renewal_orders_id_seq OWNER TO postgres;

--
-- Name: renewal_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.renewal_orders_id_seq OWNED BY public.renewal_orders.id;


--
-- Name: reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reports (
    id integer NOT NULL,
    reporter_id character varying NOT NULL,
    target_type text NOT NULL,
    target_id integer NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text,
    admin_note text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.reports OWNER TO postgres;

--
-- Name: reports_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reports_id_seq OWNER TO postgres;

--
-- Name: reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reports_id_seq OWNED BY public.reports.id;


--
-- Name: revenue_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.revenue_transactions (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    type text NOT NULL,
    amount real NOT NULL,
    description text,
    campaign_id integer,
    channel_id integer,
    created_at timestamp without time zone DEFAULT now(),
    amount_egp real DEFAULT 0
);


ALTER TABLE public.revenue_transactions OWNER TO postgres;

--
-- Name: revenue_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.revenue_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.revenue_transactions_id_seq OWNER TO postgres;

--
-- Name: revenue_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.revenue_transactions_id_seq OWNED BY public.revenue_transactions.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: smart_menus; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.smart_menus (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    slug character varying NOT NULL,
    restaurant_name text,
    restaurant_slogan text,
    theme text DEFAULT 'classic'::text,
    style text DEFAULT 'photo'::text,
    items jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    views_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.smart_menus OWNER TO postgres;

--
-- Name: smart_menus_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.smart_menus_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.smart_menus_id_seq OWNER TO postgres;

--
-- Name: smart_menus_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.smart_menus_id_seq OWNED BY public.smart_menus.id;


--
-- Name: stories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stories (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    media_url text NOT NULL,
    media_type text DEFAULT 'image'::text NOT NULL,
    caption text,
    views_count integer DEFAULT 0,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.stories OWNER TO postgres;

--
-- Name: stories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stories_id_seq OWNER TO postgres;

--
-- Name: stories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stories_id_seq OWNED BY public.stories.id;


--
-- Name: story_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.story_views (
    id integer NOT NULL,
    story_id integer NOT NULL,
    viewer_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.story_views OWNER TO postgres;

--
-- Name: story_views_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.story_views_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.story_views_id_seq OWNER TO postgres;

--
-- Name: story_views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.story_views_id_seq OWNED BY public.story_views.id;


--
-- Name: stream_moderation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stream_moderation (
    id integer NOT NULL,
    stream_id integer,
    status text DEFAULT 'pending'::text,
    ai_verdict text,
    ai_reason text,
    reviewed_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.stream_moderation OWNER TO postgres;

--
-- Name: stream_moderation_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stream_moderation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stream_moderation_id_seq OWNER TO postgres;

--
-- Name: stream_moderation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stream_moderation_id_seq OWNED BY public.stream_moderation.id;


--
-- Name: uploaded_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.uploaded_files (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    filename text NOT NULL,
    original_name text NOT NULL,
    mime_type text NOT NULL,
    size integer NOT NULL,
    url text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.uploaded_files OWNER TO postgres;

--
-- Name: uploaded_files_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.uploaded_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.uploaded_files_id_seq OWNER TO postgres;

--
-- Name: uploaded_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.uploaded_files_id_seq OWNED BY public.uploaded_files.id;


--
-- Name: user_follows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_follows (
    id integer NOT NULL,
    follower_id character varying NOT NULL,
    following_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_follows OWNER TO postgres;

--
-- Name: user_follows_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_follows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_follows_id_seq OWNER TO postgres;

--
-- Name: user_follows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_follows_id_seq OWNED BY public.user_follows.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email character varying,
    first_name character varying,
    last_name character varying,
    profile_image_url character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    password_hash text,
    phone character varying(20),
    is_banned boolean DEFAULT false,
    role text DEFAULT 'user'::text,
    governorate text,
    interests text,
    bio text,
    referral_code character varying(20),
    birthday date,
    job_title character varying(100),
    company character varying(100),
    city character varying(100),
    relationship_status character varying(30),
    balance_egp real DEFAULT 0,
    gender text,
    account_type text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: wallet_top_up_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallet_top_up_orders (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    amount_egp real NOT NULL,
    payment_method text NOT NULL,
    payment_ref text,
    screenshot_url text,
    status text DEFAULT 'pending'::text,
    admin_note text,
    order_number text,
    created_at timestamp without time zone DEFAULT now(),
    reviewed_at timestamp without time zone,
    reviewed_by character varying
);


ALTER TABLE public.wallet_top_up_orders OWNER TO postgres;

--
-- Name: wallet_top_up_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wallet_top_up_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wallet_top_up_orders_id_seq OWNER TO postgres;

--
-- Name: wallet_top_up_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wallet_top_up_orders_id_seq OWNED BY public.wallet_top_up_orders.id;


--
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallet_transactions (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    type text NOT NULL,
    amount_egp real NOT NULL,
    description text,
    ref_id text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.wallet_transactions OWNER TO postgres;

--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wallet_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wallet_transactions_id_seq OWNER TO postgres;

--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wallet_transactions_id_seq OWNED BY public.wallet_transactions.id;


--
-- Name: ad_campaigns id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ad_campaigns ALTER COLUMN id SET DEFAULT nextval('public.ad_campaigns_id_seq'::regclass);


--
-- Name: ad_impressions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ad_impressions ALTER COLUMN id SET DEFAULT nextval('public.ad_impressions_id_seq'::regclass);


--
-- Name: ad_link_clicks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ad_link_clicks ALTER COLUMN id SET DEFAULT nextval('public.ad_link_clicks_id_seq'::regclass);


--
-- Name: admin_activity_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_activity_log ALTER COLUMN id SET DEFAULT nextval('public.admin_activity_log_id_seq'::regclass);


--
-- Name: ads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ads ALTER COLUMN id SET DEFAULT nextval('public.ads_id_seq'::regclass);


--
-- Name: ai_usage id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_usage ALTER COLUMN id SET DEFAULT nextval('public.ai_usage_id_seq'::regclass);


--
-- Name: boost_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boost_orders ALTER COLUMN id SET DEFAULT nextval('public.boost_orders_id_seq'::regclass);


--
-- Name: channel_subscriptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.channel_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.channel_subscriptions_id_seq'::regclass);


--
-- Name: channels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.channels ALTER COLUMN id SET DEFAULT nextval('public.channels_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: coin_packages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coin_packages ALTER COLUMN id SET DEFAULT nextval('public.coin_packages_id_seq'::regclass);


--
-- Name: coin_purchase_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coin_purchase_orders ALTER COLUMN id SET DEFAULT nextval('public.coin_purchase_orders_id_seq'::regclass);


--
-- Name: coin_recharge_codes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coin_recharge_codes ALTER COLUMN id SET DEFAULT nextval('public.coin_recharge_codes_id_seq'::regclass);


--
-- Name: coin_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coin_transactions ALTER COLUMN id SET DEFAULT nextval('public.coin_transactions_id_seq'::regclass);


--
-- Name: coin_wallets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coin_wallets ALTER COLUMN id SET DEFAULT nextval('public.coin_wallets_id_seq'::regclass);


--
-- Name: comments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);


--
-- Name: consultations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consultations ALTER COLUMN id SET DEFAULT nextval('public.consultations_id_seq'::regclass);


--
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- Name: coupons id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupons ALTER COLUMN id SET DEFAULT nextval('public.coupons_id_seq'::regclass);


--
-- Name: direct_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.direct_messages ALTER COLUMN id SET DEFAULT nextval('public.direct_messages_id_seq'::regclass);


--
-- Name: favorites id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorites ALTER COLUMN id SET DEFAULT nextval('public.favorites_id_seq'::regclass);


--
-- Name: follows id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows ALTER COLUMN id SET DEFAULT nextval('public.follows_id_seq'::regclass);


--
-- Name: fraud_alerts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fraud_alerts ALTER COLUMN id SET DEFAULT nextval('public.fraud_alerts_id_seq'::regclass);


--
-- Name: likes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.likes ALTER COLUMN id SET DEFAULT nextval('public.likes_id_seq'::regclass);


--
-- Name: live_streams id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.live_streams ALTER COLUMN id SET DEFAULT nextval('public.live_streams_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: offers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offers ALTER COLUMN id SET DEFAULT nextval('public.offers_id_seq'::regclass);


--
-- Name: payment_notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_notifications ALTER COLUMN id SET DEFAULT nextval('public.payment_notifications_id_seq'::regclass);


--
-- Name: payment_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_requests ALTER COLUMN id SET DEFAULT nextval('public.payment_requests_id_seq'::regclass);


--
-- Name: platform_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_settings ALTER COLUMN id SET DEFAULT nextval('public.platform_settings_id_seq'::regclass);


--
-- Name: push_subscriptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.push_subscriptions_id_seq'::regclass);


--
-- Name: ratings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ratings ALTER COLUMN id SET DEFAULT nextval('public.ratings_id_seq'::regclass);


--
-- Name: reels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reels ALTER COLUMN id SET DEFAULT nextval('public.reels_id_seq'::regclass);


--
-- Name: referrals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referrals ALTER COLUMN id SET DEFAULT nextval('public.referrals_id_seq'::regclass);


--
-- Name: renewal_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.renewal_orders ALTER COLUMN id SET DEFAULT nextval('public.renewal_orders_id_seq'::regclass);


--
-- Name: reports id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports ALTER COLUMN id SET DEFAULT nextval('public.reports_id_seq'::regclass);


--
-- Name: revenue_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.revenue_transactions ALTER COLUMN id SET DEFAULT nextval('public.revenue_transactions_id_seq'::regclass);


--
-- Name: smart_menus id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.smart_menus ALTER COLUMN id SET DEFAULT nextval('public.smart_menus_id_seq'::regclass);


--
-- Name: stories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stories ALTER COLUMN id SET DEFAULT nextval('public.stories_id_seq'::regclass);


--
-- Name: story_views id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_views ALTER COLUMN id SET DEFAULT nextval('public.story_views_id_seq'::regclass);


--
-- Name: stream_moderation id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_moderation ALTER COLUMN id SET DEFAULT nextval('public.stream_moderation_id_seq'::regclass);


--
-- Name: uploaded_files id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.uploaded_files ALTER COLUMN id SET DEFAULT nextval('public.uploaded_files_id_seq'::regclass);


--
-- Name: user_follows id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_follows ALTER COLUMN id SET DEFAULT nextval('public.user_follows_id_seq'::regclass);


--
-- Name: wallet_top_up_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_top_up_orders ALTER COLUMN id SET DEFAULT nextval('public.wallet_top_up_orders_id_seq'::regclass);


--
-- Name: wallet_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_transactions ALTER COLUMN id SET DEFAULT nextval('public.wallet_transactions_id_seq'::regclass);


--
-- Data for Name: ad_campaigns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ad_campaigns (id, advertiser_id, name, description, media_url, media_type, target_url, target_languages, target_categories, budget, spent, cpm_rate, publisher_rev_share, impressions, clicks, status, embed_code, created_at, target_regions, target_age_min, target_age_max, budget_egp, spent_egp, cpm_rate_egp, click_tracking_code) FROM stdin;
2	54219806	تطبيق سوق ماركات 	عروض وخصومات  من تطبيق سوق ماركات 		video	https://play.google.com/store/apps/details?id=com.apmo.souqmarket	{ar}	{}	0	0	5	0.6	29	5	active	<script src="/api/campaigns/embed.js?id=2&key=dcef081e-06f" async></script>	2026-03-26 17:44:22.837599	{}	\N	\N	50	15.045002	77	<!-- كود تتبع النقرات - Google AdSense Style -->\n<img src="/api/campaigns/2/click?ref=PUBLISHER_ID" width="1" height="1" style="display:none">
1	54219806	تطبيق سوق ماركات 	تسويق وبيع منتجات  الاجهزة الكهربتئة 	/uploads/742eaa8c-c1e8-4fa9-840e-fb7e9c0f8d29.jpg	image	https://play.google.com/store/apps/details?id=com.apmo.souqmarket	{"المهتم بشراء  المنتجات"}	{"المقطم القاهرة  ومدينة نصر"}	50	0	50	0.6	31	9	active	<script src="/api/campaigns/embed.js?id=1&key=2ccc645b" async></script>	2026-03-26 00:52:22.927443	\N	\N	\N	0	7.71	15	\N
\.


--
-- Data for Name: ad_impressions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ad_impressions (id, campaign_id, channel_id, user_id, ip_address, user_agent, event_type, is_fraud, fraud_reason, created_at) FROM stdin;
1	1	1	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 15:02:34.817686
2	1	1	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	click	t	self_click_advertiser	2026-03-29 15:02:45.671642
3	1	1	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 15:03:05.558348
4	2	1	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 15:03:35.714642
5	1	1	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 15:04:05.570585
6	2	2	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 16:57:20.491924
7	2	2	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	click	t	self_click_advertiser	2026-03-29 16:57:24.225028
8	2	2	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	click	t	self_click_advertiser	2026-03-29 16:57:40.441025
9	2	2	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 16:57:50.512706
10	1	\N	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 16:57:58.131314
11	1	\N	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	click	t	self_click_advertiser	2026-03-29 16:58:03.537066
12	1	\N	56d29356-b8a4-4572-a90d-5e9f99e7713f	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-03-29 17:00:27.582489
13	2	\N	56d29356-b8a4-4572-a90d-5e9f99e7713f	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-03-29 17:00:47.471497
14	2	\N	56d29356-b8a4-4572-a90d-5e9f99e7713f	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	click	f	\N	2026-03-29 17:00:54.144826
15	1	\N	56d29356-b8a4-4572-a90d-5e9f99e7713f	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-03-29 17:01:07.468122
16	1	2	56d29356-b8a4-4572-a90d-5e9f99e7713f	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-03-29 17:01:51.478603
17	2	2	56d29356-b8a4-4572-a90d-5e9f99e7713f	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-03-29 17:02:21.632819
18	2	\N	56d29356-b8a4-4572-a90d-5e9f99e7713f	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-03-29 17:02:44.255354
19	1	\N	56d29356-b8a4-4572-a90d-5e9f99e7713f	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-03-29 17:03:04.270469
20	1	\N	56d29356-b8a4-4572-a90d-5e9f99e7713f	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-03-29 17:03:24.157832
21	1	\N	56d29356-b8a4-4572-a90d-5e9f99e7713f	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_5	2026-03-29 17:03:44.291089
22	1	\N	56d29356-b8a4-4572-a90d-5e9f99e7713f	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_6	2026-03-29 17:04:04.199721
23	1	\N	56d29356-b8a4-4572-a90d-5e9f99e7713f	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	click	f	\N	2026-03-29 17:04:11.958194
24	1	\N	56d29356-b8a4-4572-a90d-5e9f99e7713f	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_7	2026-03-29 17:04:24.189275
25	1	\N	56d29356-b8a4-4572-a90d-5e9f99e7713f	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_8	2026-03-29 17:04:44.16787
26	2	\N	56d29356-b8a4-4572-a90d-5e9f99e7713f	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-03-29 17:05:04.149713
27	1	1	56d29356-b8a4-4572-a90d-5e9f99e7713f	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_9	2026-03-29 17:48:17.76076
28	1	1	56d29356-b8a4-4572-a90d-5e9f99e7713f	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_10	2026-03-29 17:48:47.640735
29	2	1	\N	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-03-29 18:33:39.209827
30	1	1	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 18:33:40.17993
31	1	1	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 18:34:09.326938
32	1	1	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 18:34:39.349828
33	2	1	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 19:47:49.2251
34	1	1	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 19:48:18.339133
35	2	\N	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 19:48:20.16435
36	2	\N	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 19:48:40.057217
37	1	\N	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 19:49:00.082492
38	1	\N	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 19:49:20.052133
39	2	\N	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 19:49:40.152978
40	1	\N	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 19:50:00.168573
41	2	\N	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 19:50:20.189119
42	2	\N	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 19:50:40.058097
43	1	\N	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 19:51:00.213372
44	2	\N	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 19:51:20.08704
45	1	\N	54219806	169.150.218.69	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 19:51:40.165731
46	1	\N	54165148	156.213.188.30	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-03-29 20:54:55.817439
47	1	\N	54165148	156.213.188.30	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	click	f	\N	2026-03-29 20:55:05.029355
48	1	\N	54165148	156.213.188.30	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-03-29 20:55:15.799849
49	1	\N	54165148	156.213.188.30	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	click	f	\N	2026-03-29 20:55:19.893602
50	2	2	54165148	156.213.188.30	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-03-29 21:09:49.512758
51	2	2	54165148	156.213.188.30	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	click	f	\N	2026-03-29 21:09:54.211951
52	1	2	54165148	156.213.188.30	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-03-29 21:10:19.51025
53	2	\N	54165148	156.213.188.30	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-03-29 22:44:17.818376
54	1	1	\N	156.213.188.30	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-03-29 23:51:27.046944
55	1	1	54219806	156.213.188.30	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 23:51:27.930117
56	1	1	54219806	156.213.188.30	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 23:51:57.195728
57	2	1	54219806	156.213.188.30	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 23:52:27.196469
58	1	1	54219806	156.213.188.30	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 23:52:57.19133
59	1	1	54219806	156.213.188.30	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 23:53:27.197147
60	2	1	54219806	156.213.188.30	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 23:53:57.206846
61	2	1	54219806	156.213.188.30	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 23:54:27.178646
62	2	1	54219806	156.213.188.30	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-29 23:54:57.18865
63	2	1	54219806	197.42.144.192	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-30 19:32:03.507402
64	1	1	54219806	197.42.144.192	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-30 19:32:33.600046
65	1	1	54219806	197.42.144.192	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-03-30 19:33:03.514991
66	1	2	54165148	102.46.47.211	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-03-31 16:36:43.787272
67	1	\N	54165148	102.46.47.211	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-03-31 16:37:01.465631
68	1	\N	54165148	102.46.47.211	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-03-31 16:37:27.516994
69	2	2	54165148	102.46.47.211	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-03-31 16:37:33.760549
70	2	2	54165148	102.46.47.211	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-03-31 19:50:19.951506
71	1	2	54165148	102.46.47.211	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-03-31 19:50:27.91722
72	1	\N	54165148	102.46.47.211	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-03-31 19:50:41.565145
73	1	\N	54165148	102.46.47.211	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	click	f	\N	2026-03-31 19:50:49.334469
74	1	\N	54165148	102.46.47.211	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	click	f	\N	2026-03-31 19:50:56.965528
75	2	\N	54165148	102.46.47.211	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-03-31 19:51:02.536841
76	2	\N	54165148	102.46.47.211	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-03-31 19:52:59.932892
77	1	2	54165148	102.46.47.211	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-03-31 19:53:02.389967
78	1	\N	54219806	102.46.47.211	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-01 00:46:41.732232
79	1	\N	54219806	102.46.47.211	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-01 00:47:01.646803
80	2	\N	54219806	102.46.47.211	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-01 00:47:21.680531
81	2	\N	54219806	102.46.47.211	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-01 00:47:42.906819
82	2	\N	54219806	102.46.47.211	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-01 00:48:01.680621
83	2	\N	54219806	102.46.47.211	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-01 00:48:21.660667
84	1	\N	54219806	102.46.47.211	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-01 00:48:41.674294
85	1	\N	54219806	102.46.47.211	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-01 00:49:01.653102
86	1	\N	54219806	102.46.47.211	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-01 00:49:21.639841
87	2	\N	54219806	102.46.47.211	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-01 00:49:41.751681
88	2	\N	54219806	102.46.47.211	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-01 00:50:01.705815
89	1	\N	54219806	102.46.47.211	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-01 00:50:21.696499
90	2	\N	54219806	102.46.47.211	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-01 00:50:41.706666
91	2	\N	54219806	102.46.47.211	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-01 00:51:01.973814
92	2	\N	54219806	102.46.47.211	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-01 00:51:21.64792
93	2	\N	54219806	102.46.47.211	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-01 00:51:41.656342
94	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 03:14:00.332172
95	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:02:22.327111
96	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:02:32.218529
97	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	click	t	self_click_advertiser	2026-04-04 04:02:35.930921
98	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:02:52.450689
99	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:02:52.640697
100	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:04:34.450264
101	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:04:38.417625
102	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	click	t	self_click_advertiser	2026-04-04 04:04:40.193261
103	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:04:53.444284
104	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:04:53.862968
105	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	click	t	self_click_advertiser	2026-04-04 04:05:02.305069
106	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:05:09.129609
107	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:05:24.165818
108	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:05:32.918246
109	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:05:33.102985
110	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:05:39.583872
111	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:06:28.476454
112	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	click	t	self_click_advertiser	2026-04-04 04:06:31.211711
113	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:06:43.519648
114	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:06:59.139701
115	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:07:14.146769
116	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:07:29.153004
117	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:07:44.178802
118	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:07:59.145479
119	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:08:26.192672
120	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:09:26.236924
121	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:10:26.197692
122	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:11:14.484971
123	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:11:18.962461
124	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	click	t	self_click_advertiser	2026-04-04 04:11:33.449743
125	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:11:34.108909
126	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:11:42.871704
127	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:11:57.899899
128	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:12:12.909964
129	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:12:27.90343
130	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:12:42.907249
131	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:12:58.279679
132	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:13:12.906797
133	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:13:27.899216
134	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:13:42.942556
135	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:13:57.933862
136	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:14:12.932249
137	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:14:27.918614
138	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:14:42.903646
139	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:14:55.172831
140	1	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:14:55.353763
141	2	\N	54219806	156.213.137.179	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-04 04:15:10.337969
142	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-04-07 18:34:42.744152
143	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-04-07 18:34:57.753291
144	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-04-07 18:35:02.112591
145	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-04-07 18:35:17.153192
146	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-04-07 18:35:32.129383
147	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-04-07 18:35:47.171399
148	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-04-07 18:35:52.046095
149	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-04-07 18:36:11.546554
150	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-04-07 18:36:11.796499
151	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	f	\N	2026-04-07 18:36:18.933809
152	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_5	2026-04-07 18:36:19.121857
153	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_6	2026-04-07 18:36:34.066032
154	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_7	2026-04-07 18:36:49.123357
155	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_5	2026-04-07 18:37:04.080727
156	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_6	2026-04-07 18:37:19.093907
157	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_7	2026-04-07 18:37:34.123609
158	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_8	2026-04-07 18:37:49.076917
159	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_9	2026-04-07 18:38:04.106435
160	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_8	2026-04-07 18:38:19.086673
161	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_9	2026-04-07 18:38:34.07662
162	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_10	2026-04-07 18:38:49.087391
163	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_11	2026-04-07 18:39:04.08082
164	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_10	2026-04-07 18:39:19.101128
165	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_11	2026-04-07 18:39:34.090824
166	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_12	2026-04-07 18:39:49.079437
167	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_13	2026-04-07 18:40:04.07396
168	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_14	2026-04-07 18:40:19.083113
169	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_15	2026-04-07 18:40:34.078071
170	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_12	2026-04-07 18:40:49.071679
171	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_13	2026-04-07 18:41:04.082715
172	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_14	2026-04-07 18:41:19.076297
173	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_16	2026-04-07 18:41:34.102869
174	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_17	2026-04-07 18:41:49.083961
175	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_18	2026-04-07 18:42:04.078786
176	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_15	2026-04-07 18:42:19.087829
177	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_16	2026-04-07 18:42:34.116824
178	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_17	2026-04-07 18:42:49.072642
179	2	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_18	2026-04-07 18:43:04.153647
180	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_19	2026-04-07 18:43:15.079038
181	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	click	f	\N	2026-04-07 18:43:17.781424
182	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	click	f	\N	2026-04-07 18:43:20.827115
183	1	\N	54165148	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	duplicate_impression_20	2026-04-07 18:43:30.091814
184	2	\N	54219806	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-08 17:54:33.169331
185	1	\N	54219806	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-08 17:54:40.744529
186	2	\N	54219806	197.52.20.41	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-08 17:54:40.94813
187	2	\N	f1bea370-0eff-4578-9bc0-e9034e32d9fd	197.52.130.251	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-04-13 16:31:57.184037
188	2	\N	f1bea370-0eff-4578-9bc0-e9034e32d9fd	197.52.130.251	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-04-13 16:31:57.666219
189	2	\N	f1bea370-0eff-4578-9bc0-e9034e32d9fd	197.52.130.251	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-04-13 16:32:03.333752
190	2	\N	f1bea370-0eff-4578-9bc0-e9034e32d9fd	197.52.130.251	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-04-13 16:32:15.998994
191	2	\N	f1bea370-0eff-4578-9bc0-e9034e32d9fd	197.52.130.251	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-04-13 16:32:19.502352
192	2	\N	f1bea370-0eff-4578-9bc0-e9034e32d9fd	197.52.130.251	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	t	duplicate_impression_5	2026-04-13 16:32:21.427585
193	2	\N	f1bea370-0eff-4578-9bc0-e9034e32d9fd	197.52.130.251	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	click	f	\N	2026-04-13 16:32:22.648603
194	2	\N	f1bea370-0eff-4578-9bc0-e9034e32d9fd	197.52.130.251	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	click	f	\N	2026-04-13 16:32:26.414333
195	2	\N	f1bea370-0eff-4578-9bc0-e9034e32d9fd	197.52.130.251	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	t	duplicate_impression_6	2026-04-13 16:33:14.325687
196	1	\N	f1bea370-0eff-4578-9bc0-e9034e32d9fd	197.52.130.251	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-04-13 16:33:18.206754
197	2	\N	f1bea370-0eff-4578-9bc0-e9034e32d9fd	197.52.130.251	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36	impression	t	duplicate_impression_7	2026-04-13 16:33:26.4814
198	1	\N	\N	197.52.130.251	Mozilla/5.0 (Linux; Android 14; SM-A235F Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/556.0.0.59.68;]	impression	f	\N	2026-04-13 16:35:33.20505
199	1	\N	db4019e3-eb97-4d90-aac2-4bbe570905b1	197.52.117.17	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-04-16 00:09:30.459271
200	2	\N	db4019e3-eb97-4d90-aac2-4bbe570905b1	197.52.117.17	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-04-16 00:09:34.610593
201	1	\N	db4019e3-eb97-4d90-aac2-4bbe570905b1	197.52.117.17	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-04-16 00:10:09.847339
202	1	\N	db4019e3-eb97-4d90-aac2-4bbe570905b1	197.52.117.17	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	click	f	\N	2026-04-16 00:10:11.673657
203	1	\N	db4019e3-eb97-4d90-aac2-4bbe570905b1	197.52.117.17	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-04-16 00:10:27.309055
204	2	\N	db4019e3-eb97-4d90-aac2-4bbe570905b1	197.52.117.17	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-04-16 00:10:39.121897
205	2	\N	db4019e3-eb97-4d90-aac2-4bbe570905b1	197.52.117.17	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-04-16 00:10:40.469299
206	2	\N	db4019e3-eb97-4d90-aac2-4bbe570905b1	197.52.117.17	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-04-16 00:10:41.289698
207	1	\N	db4019e3-eb97-4d90-aac2-4bbe570905b1	197.52.117.17	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36	impression	f	\N	2026-04-16 00:10:41.699861
208	2	\N	54219806	156.213.215.23	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-18 14:31:40.823892
209	2	\N	54219806	156.213.215.23	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-18 14:31:44.970074
210	1	\N	54219806	156.213.215.23	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	impression	t	self_click_advertiser	2026-04-18 14:31:49.571252
\.


--
-- Data for Name: ad_link_clicks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ad_link_clicks (id, ad_id, link_type, dest_url, ip, user_agent, user_id, is_fraud, fraud_reason, created_at) FROM stdin;
1	65	appgallery	https://app.as-souqmarkat.com/?from-splash=false	197.52.34.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	\N	f	\N	2026-04-10 02:13:51.641911
2	65	googleplay	https://play.google.com/store/apps/details?id=com.apmo.souqmarket	197.52.34.58	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	\N	f	\N	2026-04-10 02:14:03.157451
\.


--
-- Data for Name: admin_activity_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admin_activity_log (id, admin_id, action, target, details, created_at) FROM stdin;
1	54219806	update_payment	pay#2	approved	2026-03-29 14:56:28.800914
2	54219806	broadcast_notification	all_users	عروض وخصومات من تطبيق  سوق ماركلت لم تدفع  اعلانانك مت مدفوعات شركة سوق ماركات 	2026-03-29 16:42:23.045665
3	54219806	update_ad	ad#11	{"title":"تطبيق سوق ماركات","priceEGP":"","status":"active"}	2026-03-29 18:15:04.324826
4	54219806	update_channel	ch#3		2026-03-29 22:39:47.735016
5	54219806	update_channel	ch#3		2026-03-29 22:39:50.678556
6	54219806	update_channel	ch#3		2026-03-29 22:39:51.537004
7	54219806	update_ad	ad#46	{"title":"سوق ماركات – تسوّق عالمي بكل سهولة","priceEGP":"50","status":"active"}	2026-03-30 00:03:17.864881
8	54219806	update_ad	ad#46	{"status":"paused"}	2026-03-30 00:03:21.803081
9	54219806	update_ad	ad#46	{"status":"active"}	2026-03-30 00:03:22.873477
10	54219806	delete_ad	ad#46		2026-03-30 00:05:16.301754
11	54219806	update_stream	stream#1	ended	2026-03-31 20:55:23.808586
12	54219806	update_stream	stream#2	ended	2026-03-31 20:55:31.273752
13	54219806	update_channel	ch#3		2026-03-31 22:23:36.569392
14	54219806	update_channel	ch#3		2026-03-31 22:23:39.023872
15	54219806	update_channel	ch#2		2026-03-31 22:23:40.800307
16	54219806	update_channel	ch#1		2026-03-31 22:23:43.029862
17	54219806	reset_password	541ad010-4694-4b7b-8574-63c29da5320c		2026-03-31 22:23:59.377451
18	54219806	update_user	541ad010-4694-4b7b-8574-63c29da5320c	{"isBanned":true}	2026-03-31 22:24:11.740952
19	54219806	update_user	541ad010-4694-4b7b-8574-63c29da5320c	{"isBanned":false}	2026-03-31 22:24:12.4496
20	54219806	update_user	541ad010-4694-4b7b-8574-63c29da5320c	{"isBanned":true}	2026-03-31 22:24:13.889235
21	54219806	update_user	54165148	{"isBanned":true}	2026-03-31 22:24:15.910273
22	54219806	update_user	56d29356-b8a4-4572-a90d-5e9f99e7713f	{"isBanned":true}	2026-03-31 22:24:17.366884
23	54219806	toggle_feature	boost_enabled	إيقاف	2026-03-31 22:29:29.92362
24	54219806	toggle_feature	boost_enabled	تفعيل	2026-03-31 22:29:33.004507
25	54219806	toggle_feature	boost_enabled	إيقاف	2026-03-31 22:29:33.60997
26	54219806	toggle_feature	boost_enabled	تفعيل	2026-03-31 22:29:35.669741
27	54219806	update_user	56d29356-b8a4-4572-a90d-5e9f99e7713f	{"isBanned":false}	2026-03-31 22:30:22.03559
28	54219806	update_user	54165148	{"isBanned":false}	2026-03-31 22:30:23.037804
29	54219806	update_user	56d29356-b8a4-4572-a90d-5e9f99e7713f	{"isBanned":true}	2026-03-31 22:30:26.365605
30	54219806	update_user	54165148	{"isBanned":true}	2026-03-31 22:30:27.667132
31	54219806	update_settings	platform_settings	["ai_price_per_credit_egp"]	2026-03-31 22:41:54.564999
32	54219806	update_settings	platform_settings	["boost_price_egp","publisher_rev_share","cpm_rate_egp"]	2026-03-31 22:42:50.812421
33	54219806	update_ad	ad#47	{"status":"paused"}	2026-03-31 22:43:16.674454
34	54219806	update_ad	ad#47	{"status":"active"}	2026-03-31 22:43:21.059999
35	54219806	update_payment	pay#3	approved	2026-03-31 22:48:46.640646
36	54219806	update_payment	pay#4	approved	2026-03-31 22:51:03.996462
37	54219806	update_ad	ad#47	{"title":"سوق ماركات - تطبيق يحول تسوقك لتجربة سينمائية!","priceEGP":"","status":"active"}	2026-03-31 22:52:09.564331
38	54219806	update_payment	pay#5	approved	2026-04-01 03:29:48.929991
39	54219806	update_payment	pay#5	approved	2026-04-01 03:29:48.949725
40	54219806	update_user	56d29356-b8a4-4572-a90d-5e9f99e7713f	{"isBanned":false}	2026-04-02 20:19:28.000669
41	54219806	update_stream	stream#10	ended	2026-04-02 20:20:35.733762
42	54219806	update_stream	stream#11	ended	2026-04-02 20:20:40.709784
43	54219806	update_ad	ad#10	{"title":"النزاع العالمي: إيران، أمريكا، ودولة الاحتلال","priceEGP":"","status":"active"}	2026-04-02 20:23:00.431285
44	54219806	update_payment	pay#6	approved	2026-04-03 22:25:06.370568
45	54219806	update_settings	platform_settings	["ai_free_credits"]	2026-04-03 22:25:54.251278
46	54219806	update_user	54165148	{"isBanned":false}	2026-04-04 03:07:23.982127
47	54219806	update_ad	ad#60	{"status":"active"}	2026-04-04 03:08:07.653388
48	54219806	update_ad	ad#60	{"status":"paused"}	2026-04-04 03:08:10.852393
49	54219806	update_ad	ad#49	{"status":"active"}	2026-04-04 03:08:41.704679
50	54219806	update_ad	ad#49	{"status":"paused"}	2026-04-04 03:08:46.940368
51	54219806	update_ad	ad#49	{"status":"active"}	2026-04-04 03:08:48.722485
52	54219806	update_user	541ad010-4694-4b7b-8574-63c29da5320c	{"isBanned":false}	2026-04-04 03:09:15.1181
53	54219806	update_user	541ad010-4694-4b7b-8574-63c29da5320c	{"isBanned":true}	2026-04-04 03:09:23.692057
54	54219806	update_settings	platform_settings	["promo_banner_text"]	2026-04-04 03:11:03.692725
55	54219806	reset_password	54165148		2026-04-04 04:30:18.648151
56	54219806	update_settings	platform_settings	["contact_whatsapp"]	2026-04-04 05:15:07.960637
57	54219806	update_settings	platform_settings	["coupon_price_egp"]	2026-04-04 05:15:22.03907
58	54219806	toggle_feature	boost_enabled	إيقاف	2026-04-04 05:15:37.168947
59	54219806	toggle_feature	boost_enabled	تفعيل	2026-04-04 05:15:39.603747
60	54219806	update_ad	ad#60	{"status":"active"}	2026-04-04 19:07:29.22943
61	54219806	update_ad	ad#59	{"status":"active"}	2026-04-04 19:07:32.185474
62	54219806	update_ad	ad#58	{"status":"active"}	2026-04-04 19:07:34.105866
63	54219806	update_ad	ad#57	{"status":"active"}	2026-04-04 19:07:35.561408
64	54219806	update_ad	ad#56	{"status":"active"}	2026-04-04 19:07:37.596989
65	54219806	update_ad	ad#55	{"status":"active"}	2026-04-04 19:07:39.345309
66	54219806	update_ad	ad#54	{"status":"active"}	2026-04-04 19:07:41.032237
67	54219806	update_ad	ad#53	{"status":"active"}	2026-04-04 19:07:44.831681
68	54219806	update_ad	ad#52	{"status":"active"}	2026-04-04 19:07:46.411601
69	54219806	update_ad	ad#51	{"status":"active"}	2026-04-04 19:07:48.028532
70	54219806	update_ad	ad#50	{"status":"active"}	2026-04-04 19:07:49.839421
71	54219806	update_ad	ad#47	{"title":"سوق ماركات - تطبيق يحول تسوقك لتجربة فريدة من التسوق","priceEGP":"0.00","status":"active"}	2026-04-04 19:08:29.817816
72	54219806	update_ad	ad#47	{"status":"paused"}	2026-04-04 19:08:34.218666
73	54219806	update_settings	platform_settings	["promo_banner_enabled"]	2026-04-04 19:11:02.896745
74	54219806	broadcast_notification	all_users	اشاء اعلان الان بزكاء الصناعى فة 2دقيقة	2026-04-04 19:13:05.753503
75	54219806	update_ad	ad#48	{"title":"صوت جميل","priceEGP":"","status":"active"}	2026-04-05 10:37:24.16163
76	54219806	update_ad	ad#48	{"status":"paused"}	2026-04-05 10:37:29.390046
77	54219806	update_ad	ad#45	{"status":"paused"}	2026-04-05 10:37:33.169924
78	54219806	update_ad	ad#12	{"status":"paused"}	2026-04-05 10:37:34.804231
79	54219806	update_ad	ad#11	{"status":"paused"}	2026-04-05 10:37:37.468417
80	54219806	update_ad	ad#10	{"status":"paused"}	2026-04-05 10:37:38.950779
87	54219806	update_ad	ad#1	{"status":"paused"}	2026-04-05 10:37:58.76583
81	54219806	update_ad	ad#8	{"status":"paused"}	2026-04-05 10:37:40.825709
82	54219806	update_ad	ad#9	{"status":"paused"}	2026-04-05 10:37:41.802518
83	54219806	update_ad	ad#7	{"status":"paused"}	2026-04-05 10:37:51.412376
84	54219806	update_ad	ad#6	{"status":"paused"}	2026-04-05 10:37:53.626885
85	54219806	update_ad	ad#3	{"status":"paused"}	2026-04-05 10:37:55.082415
86	54219806	update_ad	ad#2	{"status":"paused"}	2026-04-05 10:37:56.772266
88	54219806	update_ad	ad#60	{"title":"جهاز PlayStation 5 + دراعين + 3 ألعاب","priceEGP":"19500.00","status":"paused"}	2026-04-07 19:22:55.911636
89	54219806	update_ad	ad#59	{"title":"أرض للبيع — 6 أكتوبر — 500 متر","priceEGP":"2400000.00","status":"paused"}	2026-04-07 19:23:07.549657
90	54219806	update_ad	ad#58	{"title":"iPhone 14 — 128GB — مستعمل بحالة ممتازة","priceEGP":"22000.00","status":"paused"}	2026-04-07 19:23:14.253485
91	54219806	update_ad	ad#57	{"title":"شقة للبيع — الإسكندرية — سيدي بشر","priceEGP":"1850000.00","status":"paused"}	2026-04-07 19:23:22.154367
92	54219806	update_ad	ad#56	{"title":"كاميرا Sony Alpha A7 IV — Full Frame","priceEGP":"54000.00","status":"paused"}	2026-04-07 19:23:28.889935
93	54219806	update_ad	ad#55	{"title":"موتوسيكل هوندا CB300R 2023 — جديد","priceEGP":"95000.00","status":"paused"}	2026-04-07 19:23:37.396533
94	54219806	update_ad	ad#54	{"title":"مكيف كاريير 1.5 حصان بارد وساخن","priceEGP":"11500.00","status":"paused"}	2026-04-07 19:23:47.660446
95	54219806	update_ad	ad#53	{"title":"تليفزيون Samsung QLED 55 بوصة — 4K","priceEGP":"18900.00","status":"paused"}	2026-04-07 19:23:58.08613
96	54219806	update_ad	ad#52	{"title":"سيارة هيونداي إيلنترا 2022 — فل أوبشن","priceEGP":"385000.00","status":"paused"}	2026-04-07 19:24:03.682396
97	54219806	update_ad	ad#51	{"title":"شقة للإيجار — مدينة نصر — 3 غرف","priceEGP":"7500.00","status":"paused"}	2026-04-07 19:24:09.294551
98	54219806	update_ad	ad#50	{"title":"لابتوب Dell XPS 15 — Core i7 الجيل 13","priceEGP":"28500.00","status":"paused"}	2026-04-07 19:24:14.603136
99	54219806	update_ad	ad#49	{"title":"iPhone 15 Pro Max — 256GB أزرق تيتانيوم","priceEGP":"42000.00","status":"paused"}	2026-04-07 19:24:22.769245
100	54219806	update_ad	ad#47	{"title":"سوق ماركات - تطبيق يحول تسوقك لتجربة فريدة من التسوق","priceEGP":"0.00","status":"active"}	2026-04-07 19:24:47.294497
101	54219806	update_ad	ad#12	{"title":"تطبيق سوق ماركات - اختياراتك أولًا!","priceEGP":"","status":"active"}	2026-04-07 19:24:55.554529
102	54219806	update_ad	ad#11	{"title":"تطبيق سوق ماركات","priceEGP":"0.00","status":"active"}	2026-04-07 19:25:02.588474
103	54219806	update_ad	ad#10	{"title":"النزاع العالمي: إيران، أمريكا، ودولة الاحتلال","priceEGP":"0.00","status":"active"}	2026-04-07 19:25:10.363594
104	54219806	update_ad	ad#9	{"title":"لحظتك مع سن توب","priceEGP":"","status":"active"}	2026-04-07 19:25:19.693141
105	54219806	update_ad	ad#8	{"title":"رحلة الطعم العميقة – عصير  وحليب جهينة","priceEGP":"","status":"active"}	2026-04-07 19:25:31.572837
106	54219806	update_ad	ad#7	{"title":"منتجات نسلة","priceEGP":"","status":"active"}	2026-04-07 19:25:40.902469
107	54219806	update_ad	ad#6	{"title":"الإعلان السينمائي لهاتف Samsung Galaxy A26","priceEGP":"","status":"active"}	2026-04-07 19:25:47.509054
108	54219806	update_settings	platform_settings	["min_withdrawal_egp","ai_price_per_credit_egp","coupon_price_egp"]	2026-04-07 23:45:56.403235
109	54219806	update_payment	pay#7	approved	2026-04-08 02:34:24.517189
110	54219806	update_ad	ad#60	{"title":"جهاز PlayStation 5 + دراعين + 3 ألعاب","priceEGP":"19500.00","status":"paused"}	2026-04-09 20:47:08.953319
111	54219806	update_ad	ad#48	{"title":"صوت جميل","priceEGP":"0.00","status":"active"}	2026-04-11 18:30:16.006169
112	54219806	toggle_feature	feature_reels	إيقاف	2026-04-12 02:17:12.084281
113	54219806	toggle_feature	feature_reels	تفعيل	2026-04-12 02:17:14.077484
114	54219806	toggle_feature	boost_enabled	إيقاف	2026-04-12 22:20:32.049466
115	54219806	toggle_feature	boost_enabled	تفعيل	2026-04-12 22:20:34.467932
116	54219806	update_payment	pay#8	approved	2026-04-12 22:21:17.279805
117	54219806	update_settings	platform_settings	["ai_free_credits","ai_price_per_credit_egp","coupon_price_egp"]	2026-04-12 22:49:29.159911
118	54219806	update_payment	pay#9	approved	2026-04-12 23:00:40.940344
119	54219806	update_settings	platform_settings	["ai_free_credits","ai_price_per_credit_egp","coupon_price_egp"]	2026-04-12 23:07:51.075575
120	54219806	update_settings	platform_settings	["coupon_price_egp"]	2026-04-13 02:20:37.212535
121	54219806	update_ad	ad#72	{"title":"السوق المثالي للإعلانات في مصر","priceEGP":"","status":"active"}	2026-04-13 16:56:42.569645
122	54219806	update_settings	platform_settings	["min_withdrawal_egp","ai_free_credits","ai_price_per_credit_egp"]	2026-04-13 22:37:00.480883
123	54219806	wallet_topup_approve	طلب #1		2026-04-13 22:54:05.439934
124	54219806	update_payment	pay#10	approved	2026-04-13 23:30:41.914815
125	54219806	update_payment	pay#11	approved	2026-04-13 23:30:50.756684
157	54219806	wallet_topup_approve	طلب #2		2026-04-15 23:20:03.487158
158	54219806	update_campaign	camp#1	paused	2026-04-17 22:07:22.720433
159	54219806	update_campaign	camp#1	active	2026-04-17 22:07:27.324584
160	54219806	update_campaign	camp#2	paused	2026-04-17 22:07:31.560158
161	54219806	update_campaign	camp#2	active	2026-04-17 22:07:32.889948
162	54219806	update_campaign	camp#1	paused	2026-04-17 22:07:34.181251
163	54219806	update_campaign	camp#1	active	2026-04-17 22:07:39.708311
164	54219806	update_payment	pay#12	approved	2026-04-18 14:37:57.233474
\.


--
-- Data for Name: ads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ads (id, title, description, media_url, media_type, language, status, user_id, created_at, likes_count, comments_count, views_count, target_region, price_egp, whatsapp_number, payment_link, app_store_url, google_play_url, app_gallery_url, installment_months, installment_monthly_egp, target_lat, target_lng, target_radius_km, expires_at, target_interests, target_ages, whatsapp_clicks, is_boosted, boosted_until, coupon_code, coupon_discount_type, coupon_discount_value, is_admin_promo) FROM stdin;
6	الإعلان السينمائي لهاتف Samsung Galaxy A26	في عالم سريع التقدم، تلفون Samsung Galaxy A26 بيغير قواعد اللعبة بتصميمه وأداءه المميز. خليك مستعد للجديد كل يوم مع تجربة بتجمع بين القوة والأناقة.	/uploads/28d32e29-4599-4726-a006-e335af7242e8.webp	image	ar	active	54219806	2026-03-26 18:55:35.203473	2	1	17		0.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-27 00:06:59.270174	\N	\N	0	f	\N	\N	\N	\N	f
58	iPhone 14 — 128GB — مستعمل بحالة ممتازة	آيفون 14 أسود 128 جيجا — مستعمل 6 شهور فقط بحالة ممتازة مع جميع ملحقاته الأصلية	https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?w=600	image	ar	paused	54219806	2026-04-04 01:23:51.236551	0	0	3	\N	22000.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	t
45	إصنع صورة أسطورية لعيب الكرة!	انت عايز تسجل لحظة أسطورية لنجم الكرة؟ مع خدمتنا الجديدة، حنوفرلك صورة احترافية تحكي رواية نجاحه بكل تفاصيلها. خلي اللحظة دي تعيش للأبد! اطلب الآن واحنا هنخلي المستحيل ممكن.	/uploads/ai-img-1774674682918.png	image	ar	active	54165148	2026-03-28 05:11:49.194947	2	0	82		\N						\N	\N	\N	\N	\N	2026-05-07 18:45:17.67973	\N	\N	0	f	\N	\N	\N	\N	f
55	موتوسيكل هوندا CB300R 2023 — جديد	موتوسيكل هوندا CB300R موديل 2023 — لون أسود مطفي — جديد لم يُستخدم من الوكيل	https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600	image	ar	paused	54219806	2026-04-04 01:23:51.227075	0	0	3	\N	95000.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	t
8	رحلة الطعم العميقة – عصير  وحليب جهينة	تبدأ الحكاية مع عصير جهينة حليب، منتجات بتغير طريقة ما بنعيش الطعم. من الصحة، للحلاوة، للطبيعة اللي جوا كل منتج... كل لحظة هي قصة. خليك جزء من الرحلة، جرب النهارده!	/uploads/b76001d6-bc57-470b-a49a-e06752e8bf54.jpg	image	ar	active	54219806	2026-03-26 19:43:50.659314	1	0	27		0.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	f
11	تطبيق سوق ماركات	لقطة أولى: حياتك مليانة تفاصيل.. التفاصيل دي هي اللي بتصنع الفرق. مع منتجات المركت، كل تفصيلة بتبقى أحلى. خطة الترتيب اليومية أسهل، وقت الطبخ أسرع وألذ، ولو محتاج توفر أكتر أو تدلع نفسك.. المركت بيقدم الجودة اللي تستحقها بأسعار في متناول الإيد. متفكرش كتير، المركت دايماً جاهز يخدمك بأجود المنتجات. مركت.. الجودة والفرق في مكان واحد.	/uploads/a4274ed8-193f-4b9b-bec4-63794c88c8ca.jpg	image	ar	active	54219806	2026-03-26 20:38:30.312931	0	2	61		0.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	f
59	أرض للبيع — 6 أكتوبر — 500 متر	أرض سكنية 500 متر في حي الوصلة بـ 6 أكتوبر — مرافق كاملة — موقع مميز	https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600	image	ar	paused	54219806	2026-04-04 01:23:51.239105	0	0	2	\N	2400000.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	t
81	حقق مبيعاتك بتقنية الذكاء الصناعي الآن!	شبكة سوق تقدم لك إعلانات احترافية بأسعار تبدأ من 100جنيه فقط! أنشئ نصوصاً تسويقية، فيديوهات، وصوت طبيعي لجذب العملاء بسرعة، واحصل على خدمة مصرية 100% تناسب مشاريعك الصغيرة والمتوسطة.	/uploads/ai-img-1776127033347.png	image	ar	active	54219806	2026-04-14 00:29:20.851187	0	0	14		\N						\N	\N	\N	\N	\N	\N			0	f	\N	\N	\N	\N	f
9	لحظتك مع سن توب	في زحمة الحياة... لحظة منك لنفسك تستاهل حاجة بترويها. عصير سن توب، طبيعي بنكهات بتخلّي اليوم كله مختلف.	/uploads/98677098-f003-4349-8197-ca997d8ca3c7.webp	image	ar	active	54219806	2026-03-26 20:07:41.772669	1	0	33		0.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	f
7	منتجات نسلة	منتجات جيدةالجودة  من الايس كرام	/uploads/video-1774553152789.mp4	video	ar	active	54219806	2026-03-26 19:26:48.725491	1	0	19		0.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	f
56	كاميرا Sony Alpha A7 IV — Full Frame	كاميرا Sony Alpha A7 IV Full Frame مع عدسة 28-70mm — مثالية للمصورين المحترفين	https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600	image	ar	paused	54219806	2026-04-04 01:23:51.229845	0	0	6	\N	54000.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	t
3	شقة للإيجار	شقة مفروشة في وسط المدينة، قريبة من جميع الخدمات.	https://images.unsplash.com/photo-1502672260266-1c1ef2d93688	image	ar	paused	541ad010-4694-4b7b-8574-63c29da5320c	2026-02-04 17:21:37.99703	0	1	12	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	f
10	النزاع العالمي: إيران، أمريكا، ودولة الاحتلال	تتصاعد أجواء الحرب .. إيران تواجه الضغوط .. أمريكا تحشد القوات .. ودولة الاحتلال تستعد. هل نحن أمام عاصفة تغير وجه العالم؟ تابعوا الآن الحقيقة خلف الأحداث.	/uploads/ai-img-1774555835914.png	image	ar	active	54219806	2026-03-26 20:11:24.17277	1	2	22		0.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	f
2	Luxury Watch	Authentic Swiss watch, mint condition.	https://images.unsplash.com/photo-1524592094714-0f0654e20314	image	en	paused	541ad010-4694-4b7b-8574-63c29da5320c	2026-02-04 17:21:37.991032	2	1	4	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	f
57	شقة للبيع — الإسكندرية — سيدي بشر	شقة 120م في سيدي بشر — الطابق الثالث — إطلالة بحرية جزئية — تشطيب سوبر لوكس	https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600	image	ar	paused	54219806	2026-04-04 01:23:51.232919	0	0	6	\N	1850000.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	t
1	موبايل جديد للبيع	أحدث موديل، استعمال خفيف، سعر مغري جداً.	https://images.unsplash.com/photo-1511707171634-5f897ff02aa9	image	ar	paused	541ad010-4694-4b7b-8574-63c29da5320c	2026-02-04 17:21:37.986033	1	0	5	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	f
61	عروض تقسيط حصرية من سوق ماركت	استفد الآن من عرض تقسيط حصري على جميع مشترياتك من تطبيق سوق ماركت بالتعاون مع البنك الأهلي المصري! تمتع بـ 0% فوائد و0% مصاريف مقدماً عند استخدام بطاقة فيزا مشتريات البنك الأهلي المصري بالتقسيط على 6 أشهر. حمل التطبيق الآن عن طريق الرابط أو امسح رمز الـ QR الموضح في الإعلان للاستمتاع بالتسوق الذكي.	/uploads/ai-img-1775590280444.png	image	ar	active	54165148	2026-04-07 19:34:14.431406	1	0	22	الدقهلية,الشرقية,المنوفية,البحيرة,كفر الشيخ,الغربية,دمياط,القاهرة,الجيزة,الإسكندرية,مطروح,السويس,الإسماعيلية,بورسعيد,المنيا,أسيوط,سوهاج,قنا,الأقصر,أسوان,الفيوم,بني سويف,شمال سيناء,جنوب سيناء,البحر الأحمر,الوادي الجديد	\N			https://apps.apple.com/eg/app/as-souqmarket/id6740153334	https://play.google.com/store/apps/details?id=com.apmo.souqmarket		\N	\N	\N	\N	\N	\N	tech,fashion,food,real_estate,sports,travel,gaming,education,finance,health,cars,kids	18-24,25-34,35-44,45-54,55+	0	f	\N	\N	\N	\N	f
49	iPhone 15 Pro Max — 256GB أزرق تيتانيوم	آيفون 15 برو ماكس جديد متبرشم بضمان الوكيل سنة كاملة — الكاميرا الأفضل في السوق	https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600	image	ar	paused	54219806	2026-04-04 01:23:51.127076	0	0	3	\N	42000.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	t
53	تليفزيون Samsung QLED 55 بوصة — 4K	شاشة Samsung QLED 55 بوصة 4K Smart TV — جديدة متبرشمة بضمان سامسونج مصر سنتين	https://images.unsplash.com/photo-1593784991095-a205069470b6?w=600	image	ar	paused	54219806	2026-04-04 01:23:51.220875	0	0	3	\N	18900.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	t
82	انشر إعلانك في ثواني وخلي الذكاء الاصطناعي يجيب لك عملاء	هل تبحث عن منصة تجمع بين الإبداع والذكاء لجذب عملاءك؟ مع شبكة سوق للإعلانات، أصبح بإمكانك نشر إعلانك في ثوانٍ وتحقيق استهداف مثالي بفضل الذكاء الاصطناعي! منصتنا تقدم لك خدمات لا مثيل لها من إعلانات مبوبة، بث مباشر، ريلز قصيرة، وقنوات محتوى. هل أنت جاهز للسيطرة على السوق المصري؟ ابدأ الآن!	/uploads/clip-1776521878820.mp4	video	ar	active	54219806	2026-04-18 14:19:04.501866	2	0	8		\N						\N	\N	\N	\N	\N	\N			0	f	\N	\N	\N	\N	f
12	تطبيق سوق ماركات - اختياراتك أولًا!	هل مستعد تلاقي كل اللي بتحلم بيه في مكان واحد؟ تطبيق سوق ماركات هو الوجهة الأولى لكل اللي بيدور على الجودة، الراحة، والأسعار المناسبة. حمِّل التطبيق النهاردة وخليك على تواصل دايم مع أفضل الماركات بأقوى العروض!	/uploads/ca767300-bc46-48c1-9242-07e3f17fd828.jpg	image	ar	active	54219806	2026-03-28 01:53:36.3972	2	1	39		0.00						\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	f
52	سيارة هيونداي إيلنترا 2022 — فل أوبشن	هيونداي إيلنترا موديل 2022 فل أوبشن — مشيت 45 ألف كيلو — نظيفة جداً بدون حوادث	https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600	image	ar	paused	54219806	2026-04-04 01:23:51.218299	0	0	0	\N	385000.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	t
48	صوت جميل	صوت الشيخ	/uploads/83dc1667-d856-4b73-8d4f-75b372c511cf.mp4	video	ar	active	54219806	2026-04-03 00:50:34.157777	1	1	18		0.00						\N	\N	\N	\N	\N	\N			0	f	\N	\N	\N	\N	f
51	شقة للإيجار — مدينة نصر — 3 غرف	شقة مفروشة بالكامل في مدينة نصر بالقرب من المترو — 3 غرف وصالة وحمامين	https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600	image	ar	paused	54219806	2026-04-04 01:23:51.214909	0	0	2	\N	7500.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	t
54	مكيف كاريير 1.5 حصان بارد وساخن	مكيف كاريير إنفرتر 1.5 حصان بارد وساخن — موفر للكهرباء — يشمل التركيب والضمان	https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600	image	ar	paused	54219806	2026-04-04 01:23:51.223874	0	0	4	\N	11500.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	t
50	لابتوب Dell XPS 15 — Core i7 الجيل 13	لابتوب Dell XPS 15 بمعالج i7 وشاشة 4K OLED — مثالي للمصممين والمبرمجين، بحالة ممتازة	https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600	image	ar	paused	54219806	2026-04-04 01:23:51.211754	0	0	0	\N	28500.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	t
47	سوق ماركات تطبيق يحول تسوقك لتجربة فريدة من التسوق	سواء كنت بتهتم بالجودة ولا بتدور على أقوى عروض، سوق ماركات هو الحل اللي هيرفع تجربتك خطوة للأمام. هنا، الجودة بتقابل الأسعار المناسبة لتعيش تجربة تسوق مختلفة تماماً بكل التفاصيل. مع تقسيط  جميع منتجتك من فيز مشتريلت البن الاهلى المصرى	/uploads/edb2b2df-5d2c-4881-80ef-49d3c4abd124.jpg	image	ar	active	54219806	2026-03-31 22:37:03.350716	1	1	33	الدقهلية,الشرقية,المنوفية,البحيرة,كفر الشيخ,الغربية,دمياط,القاهرة,الجيزة,الإسكندرية,مطروح,السويس,الإسماعيلية,بورسعيد,المنيا,أسيوط,سوهاج,قنا,الأقصر,أسوان,الفيوم,بني سويف,شمال سيناء,جنوب سيناء,البحر الأحمر,الوادي الجديد	0.00						\N	\N	\N	\N	\N	2026-05-08 23:48:04.550315	tech,fashion,food,real_estate,sports,travel,education,kids,finance,health,cars,gaming	55+,45-54,35-44,25-34	0	f	\N	\N	\N	\N	f
60	جهاز PlayStation 5 + دراعين + 3 ألعاب	بلايستيشن 5 الإصدار الجديد مع دراعين أصليين وثلاث ألعاب — كل شيء جديد متبرشم	https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=600	image	ar	paused	54219806	2026-04-04 01:23:51.242041	0	0	4	\N	19500.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	f	\N	\N	\N	\N	t
71	شبكة سوق للإعلانات - بيع وشراء بسهولة	انشر إعلانك في ثوانٍ وتمتع بخدمات الذكاء الاصطناعي للوصول إلى ملايين المصريين. استمتع بالريلز، البث المباشر، والكوبونات لتحقق نجاحاً أكبر!	/uploads/talking-1775952573737.mp4	video	ar	active	54219806	2026-04-12 00:09:43.952071	0	0	5		\N						\N	\N	\N	\N	\N	\N			0	f	\N	\N	\N	\N	f
76	إعمل إعلانك بإيدك في دقيقة!	مع ads-as.com، الذكاء الاصطناعي هيعملك إعلان ممول احترافي بسهولة وبسرعة. جرّب الخدمة مجاناً وابدأ تجيب عملاء لمشروعك النهاردة!	/uploads/ai-img-1776035648161.png	image	ar	active	54219806	2026-04-12 23:12:40.246373	0	0	20	الدقهلية,الشرقية,المنوفية,البحيرة,كفر الشيخ,الغربية,دمياط,القاهرة,الجيزة,الإسكندرية,مطروح,السويس,الإسماعيلية,بورسعيد,المنيا,أسيوط,سوهاج,قنا,الأقصر,أسوان,الفيوم,بني سويف,شمال سيناء,جنوب سيناء,البحر الأحمر,الوادي الجديد	\N						\N	\N	\N	\N	\N	\N	fashion,gaming,kids,health,education,tech,finance,travel,food,real_estate,sports,cars	18-24,25-34,35-44,45-54	0	f	\N	\N	\N	\N	f
65	👉 أول منصة إعلانات ذكية في مصر اللي بتعمل لك كل ده تلقائي 👇	إعلانك الذكي اللي بيجيب عملاء حقيقيين في ثواني.	/uploads/ai-img-1775785474014.png	image	ar	active	54219806	2026-04-10 01:46:33.356168	1	0	18	القاهرة,الجيزة,الإسكندرية,مطروح,الدقهلية,الشرقية,المنوفية,البحيرة,كفر الشيخ,الغربية,دمياط,المنيا,أسيوط,سوهاج,قنا,الأقصر,أسوان,الفيوم,بني سويف,البحر الأحمر,الوادي الجديد,السويس,الإسماعيلية,بورسعيد,شمال سيناء,جنوب سيناء	\N			https://apps.apple.com/eg/app/as-souqmarket/id6740153334	https://play.google.com/store/apps/details?id=com.apmo.souqmarket	https://app.as-souqmarkat.com/?from-splash=false	\N	\N	\N	\N	\N	\N	tech,health,gaming,education,fashion,food,travel,sports,real_estate,kids,finance	18-24,35-44,25-34,45-54	0	f	\N	\N	\N	\N	f
80	اكتسب المعرفة	في عالم يزداد ترابطًا يومًا بعد يوم، تصبح اللغة العربية جسرًا للثقافات ونافذة للتواصل. اليوم، مع برامجنا التعليمية المتطورة، يمكنك اكتساب الطلاقة والثقة في الحديث باللغة التي تجمع ملايين القلوب. انطلق معنا في رحلة التعلم، واكتشف قوة الكلمة.	/uploads/ai-img-1776102177126.png	image	ar	active	f1bea370-0eff-4578-9bc0-e9034e32d9fd	2026-04-13 17:43:45.442002	0	0	15		\N						\N	\N	\N	\N	\N	\N			0	f	\N	\N	\N	\N	f
78	انشر إعلانك في ثواني وخلي الذكاء الاصطناعي يجيب لك عملاء	في عالم اليوم المزدحم، تحقيق النجاح يحتاج إلى الحلول الذكية. شبكة سوق للإعلانات تقدم لك الطريقة الأسهل والأسرع للوصول إلى جمهورك المثالي باستخدام قوة الذكاء الاصطناعي. حمّل إعلانك الآن، ودع التكنولوجيا تعمل من أجلك!	/uploads/ai-img-1776102049637.png	image	ar	active	54219806	2026-04-13 01:45:57.575546	0	0	12		\N						\N	\N	\N	\N	\N	\N			0	f	\N	\N	\N	\N	f
79	اشبع شهيتك واجعل البيع والشراء أسهل!	مع شبكة سوق للإعلانات، تصفّح أفضل العروض والمنتجات في مصر بسهولة، مثل أجود أنواع الطعام الشهي كالبرغر الطازج. سواء كنت بائعاً أو مشترياً، ستجد كل ما تبحث عنه في مكان واحد!	/uploads/ai-img-1776046463653.png	image	ar	active	54219806	2026-04-13 02:14:42.343697	0	0	3		\N						\N	\N	\N	\N	\N	\N			0	f	\N	\N	\N	\N	f
66	إعلانك الذكي اللي بيجيب عملاء حقيقيين في ثواني	إنت دايمًا بتدور على الطريقة المثالية توصل لعملائك؟ إحنا هنا علشان نحقق ده! خلي الذكاء الاصطناعي يعمل شغل الإعلان عنك ويجيبلك النتائج اللي تستاهلها.. في ثواني. مع 'ابدأ إعلانك الآن'، مش بس هتبيع، هتبني نجاح! يلا، اختار الذكاء، اختار النجاح.	/uploads/ai-img-1775788180072.png	image	ar	active	54219806	2026-04-10 02:30:51.695653	1	0	5	الإسكندرية,مطروح,القاهرة,الجيزة,المنيا,أسيوط,سوهاج,قنا,الأقصر,أسوان,الفيوم,بني سويف,البحر الأحمر,الوادي الجديد,السويس,الإسماعيلية,بورسعيد,شمال سيناء,جنوب سيناء	\N						\N	\N	\N	\N	\N	\N	tech,health,kids,education,fashion,food,gaming,travel,sports,real_estate,finance,cars	18-24,25-34,35-44,45-54	0	f	\N	\N	\N	\N	f
67	عوض وخصومات من تطبيق سوق ماركات	في عالم مليء بالخيارات، نحتاج لمن يجعل حياتنا أسهل وأرخص... تطبيق سوق ماركات الآن يقدم لك عروضاً حصرية على كل ما تحتاجه من الماركت، الخضار، والفواكه. كل هذا مع طرق دفع آمنة ومريحة، بالإضافة لتقسيط مميز مع فيزا مشتريات البنك الأهلي المصري. لا تفوّت الفرصة! قم بتحميل التطبيق الآن وانضم لعالم التوفير الذكي.	/uploads/ai-img-1775947254340.png	image	ar	active	54219806	2026-04-11 22:41:59.53426	0	0	9		\N						\N	\N	\N	\N	\N	\N			0	f	\N	\N	\N	\N	f
69	شبكة سوق للإعلانات — منصتك للبيع والشراء	سواء كنت بائعاً أم مشترياً، شبكة سوق للإعلانات تجمعك بملايين المصريين. انشر إعلانك بسهولة بقوة الذكاء الاصطناعي واستمتع بميزات مثل الفيديوهات المباشرة وكوبونات الخصم. سجّل الآن وابدأ!	/uploads/talking-1775951795734.mp4	video	ar	active	54219806	2026-04-11 23:57:39.799985	0	0	12		\N						\N	\N	\N	\N	\N	\N			0	f	\N	\N	\N	\N	f
63	انشر إعلانك في ثواني وخلي الذكاء الاصطناعي يجيب لك عملاء	ما تضيعش وقتك! مع منصة ads-as.com، هتنشر إعلانك في ثواني، والذكاء الاصطناعي هيجيب لك عملاء بكل سهولة. ادخل وابدأ الآن!	/uploads/ai-img-1775779904270.png	image	ar	active	54219806	2026-04-10 00:12:08.535653	0	0	7		\N						\N	\N	\N	\N	\N	\N			0	f	\N	\N	\N	\N	f
77	مديق هروميز: شريان العالم	هذا المديق الذي يشهد الصراع والتحدي، حيث يتحرك العالم نحو المستقبل وسط مياه مليئة بالأسرار والتاريخ. من هنا تبدأ الرحلة، ومن هنا يُرسم مسار الأحداث.	/uploads/ai-img-1776046238968.png	image	ar	active	54219806	2026-04-13 01:38:10.903709	0	0	6		\N						\N	\N	\N	\N	\N	\N			0	f	\N	\N	\N	\N	f
70	شبكة سوق للإعلانات - بيع وشراء بسهولة	انشر إعلانك في ثوانٍ وتمتع بخدمات الذكاء الاصطناعي للوصول إلى ملايين المصريين. استمتع بالريلز، البث المباشر، والكوبونات لتحقق نجاحاً أكبر!	/uploads/talking-1775952573737.mp4	video	ar	active	54219806	2026-04-12 00:09:43.543207	0	0	2		\N						\N	\N	\N	\N	\N	\N			0	f	\N	\N	\N	\N	f
64	منصة إعلانات ذكية تساعدك تبيع منتجاتك بسرعة	عايز تبيع أسرع؟ مش عارف تبدأ؟ ولا تكتب الإعلان؟ دلوقتي مع Ads-as.com، مش بس تبيع، ... ده الذكاء الاصطناعي بيكتب إعلانك ويوصله لعملاءه! نشر، وانتظر التفاعل. رسائل؟ مبيعات؟ أسرع مما تتخيل. Ads-as.com، البيع بقى ذكي!	/uploads/ai-img-1775780455080.png	image	ar	active	54219806	2026-04-10 00:21:56.849764	0	0	7		\N						\N	\N	\N	\N	\N	\N			0	f	\N	\N	\N	\N	f
62	عروض وخصومات من تطبيق سوق ماركات	الجملة دي تنقذ حياتك! خصم 100 جنيه لأول طلب من تطبيق سوق ماركات. هتطلب، هتوفر، وهتعيش اللحظة. أوعى تفوّت الخصم، حمل التطبيق دلوقتي!	/uploads/ai-img-1775611001405.png	image	ar	active	54219806	2026-04-08 01:17:16.715794	1	0	32		\N						\N	\N	\N	\N	\N	2026-05-08 23:48:05.474791			0	f	\N	\N	\N	\N	f
72	السوق المثالي للإعلانات في مصر	مع شبكة سوق للإعلانات، انطلق في عالم بيع وشراء بلا حدود! اكتشف العروض الأفضل من جميع المحافظات، واحصل على خصومات مذهلة وخيارات دفع مريحة تناسب الجميع.	/uploads/talking-1775954054622.mp4	video	ar	active	54219806	2026-04-12 00:35:00.325628	0	0	2		0.00						\N	\N	\N	\N	\N	\N			0	f	\N	\N	\N	\N	f
68	شبكة سوق للإعلانات — بيع واشتري في ثوانٍ	أصبح النشر والوصول لمن يبحثون عنك سريعًا وسهلًا مع شبكة سوق للإعلانات — ads-as.com، المنصة المصرية المبتكرة التي تعمل بالذكاء الاصطناعي. انضم الآن، وانشر إعلانك في ثوانٍ ليصل إلى الملايين!	/uploads/ai-img-1775950005950.png	image	ar	active	54219806	2026-04-11 23:27:12.091461	1	0	10		\N						\N	\N	\N	\N	\N	\N			0	f	\N	\N	\N	\N	f
74	سوق الإعلانات الأفضل لكل المصريين	اكتشف طريقة سهلة وسريعة للتواصل بين البائعين والمشترين في كل المحافظات. انشر إعلانك مجاناً ودع الذكاء الاصطناعي يجلب لك العملاء المثاليين!	/uploads/talking-1775954645096.mp4	video	ar	active	54219806	2026-04-12 00:44:33.562911	0	0	3		\N						\N	\N	\N	\N	\N	\N			0	f	\N	\N	\N	\N	f
73	سوقك المثالي للإعلانات في مصر	مع شبكة سوق للإعلانات، انطلق في عالم بيع وشراء بلا حدود! اكتشف العروض الأفضل من جميع المحافظات، واحصل على خصومات مذهلة وخيارات دفع مريحة تناسب الجميع.	/uploads/talking-1775954054622.mp4	video	ar	active	54219806	2026-04-12 00:35:00.517001	0	0	3		\N						\N	\N	\N	\N	\N	\N			0	f	\N	\N	\N	\N	f
75	منصة  سوق الاعلانات  بزكاء  الصناعى الان  بين ايدك	سواء كنت بائعاً أو مشترياً، مصنة سوق تجمع كل ما تحتاجه في مكان واحد! سهولة البيع والشراء بين يديك، واستمتع بخدمات تناسب احتياجاتك في جميع المحافظات.	/uploads/ai-img-1775966764178.png	image	ar	active	54219806	2026-04-12 00:53:18.488766	0	0	44		\N						\N	\N	\N	\N	\N	\N			0	f	\N	\N	\N	\N	f
\.


--
-- Data for Name: ai_usage; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_usage (id, user_id, type, credits_used, cost, created_at) FROM stdin;
1	54219806	video_script	1	0	2026-03-26 17:01:09.954705
2	54219806	image	1	0	2026-03-26 17:15:35.029869
3	54219806	video_script	1	0	2026-03-26 17:16:01.570001
4	54219806	image	1	0	2026-03-26 17:30:33.118313
5	54219806	image	1	0	2026-03-26 17:53:25.053939
6	54219806	video_script	1	0	2026-03-26 17:54:01.569059
7	54219806	image	1	0	2026-03-26 18:06:38.560768
8	54219806	video_script	1	0	2026-03-26 18:10:39.259055
9	54219806	image	1	0	2026-03-26 18:51:59.822097
10	54219806	image	1	0	2026-03-26 18:55:10.569963
11	54219806	video_script	1	0	2026-03-26 18:55:11.035247
12	54219806	image	1	0	2026-03-26 18:55:53.886319
13	54219806	image	1	0	2026-03-26 19:23:46.40762
14	54219806	video_script	1	0	2026-03-26 19:43:42.70826
15	54219806	image	1	0	2026-03-26 19:44:24.644189
16	54219806	video_script	1	0	2026-03-26 20:06:14.706637
17	54219806	image	1	0	2026-03-26 20:06:59.917413
18	54219806	copy	1	0	2026-03-26 20:09:36.938887
19	54219806	image	1	0	2026-03-26 20:10:35.934951
20	54219806	video_script	1	0	2026-03-26 20:11:08.575129
21	54219806	video_script	1	0	2026-03-26 20:38:25.682589
22	54219806	image	1	0	2026-03-28 01:36:41.307416
23	54219806	video_script	1	0	2026-03-28 01:41:30.998058
24	54219806	copy	1	0	2026-03-28 01:47:04.519188
25	54219806	video_script	1	0	2026-03-28 01:53:22.948253
58	54165148	video_script	1	0	2026-03-28 05:11:03.795897
59	54165148	image	1	0	2026-03-28 05:11:22.922505
60	54219806	copy	1	0	2026-03-29 23:58:58.327689
61	54219806	video_script	1	0	2026-03-29 23:59:02.293936
62	54219806	image	1	0	2026-03-29 23:59:32.631409
63	54219806	video_script	1	0	2026-03-31 22:34:36.103907
64	54219806	image	1	0	2026-03-31 22:35:03.938902
65	54219806	image	1	0	2026-04-02 21:32:37.142761
66	54219806	image	1	0	2026-04-02 21:35:55.29044
67	54219806	text	1	0	2026-04-02 22:01:14.503365
68	54219806	image	1	0	2026-04-02 22:02:17.000798
69	54219806	image	1	0	2026-04-04 05:21:44.418653
70	54165148	text	1	0	2026-04-07 19:30:33.542625
71	54165148	image	1	0	2026-04-07 19:31:20.449012
72	54219806	copy	1	0	2026-04-08 01:16:03.323818
73	54219806	video_script	1	0	2026-04-08 01:16:12.581117
74	54219806	image	1	0	2026-04-08 01:16:41.500616
75	54219806	image	1	0	2026-04-08 23:53:39.769358
76	54219806	copy	1	0	2026-04-10 00:11:06.026282
77	54219806	video_script	1	0	2026-04-10 00:11:13.73776
78	54219806	image	1	0	2026-04-10 00:11:44.274117
79	54219806	copy	1	0	2026-04-10 00:20:18.563258
80	54219806	video_script	1	0	2026-04-10 00:20:26.036203
81	54219806	image	1	0	2026-04-10 00:20:55.083622
82	54219806	copy	1	0	2026-04-10 01:44:01.327591
83	54219806	video_script	1	0	2026-04-10 01:44:14.725961
84	54219806	image	1	0	2026-04-10 01:44:34.01778
85	54219806	copy	1	0	2026-04-10 02:29:01.096303
86	54219806	video_script	1	0	2026-04-10 02:29:09.026841
87	54219806	image	1	0	2026-04-10 02:29:40.07655
88	54219806	copy	1	0	2026-04-11 22:40:20.194903
89	54219806	video_script	1	0	2026-04-11 22:40:28.444091
90	54219806	image	1	0	2026-04-11 22:40:54.348666
91	54219806	copy	1	0	2026-04-11 23:26:07.974068
92	54219806	video_script	1	0	2026-04-11 23:26:11.486494
93	54219806	image	1	0	2026-04-11 23:26:45.957915
94	54219806	copy	1	0	2026-04-11 23:55:29.025218
95	54219806	image	1	0	2026-04-11 23:56:19.776082
96	54219806	copy	1	0	2026-04-11 23:56:21.493409
97	54219806	talking_photo	1	0	2026-04-11 23:56:35.736014
98	54219806	copy	1	0	2026-04-12 00:08:43.767573
99	54219806	image	1	0	2026-04-12 00:09:21.105577
100	54219806	copy	1	0	2026-04-12 00:09:22.372174
101	54219806	talking_photo	1	0	2026-04-12 00:09:33.738672
102	54219806	copy	1	0	2026-04-12 00:33:21.944716
103	54219806	image	1	0	2026-04-12 00:33:58.910055
104	54219806	copy	1	0	2026-04-12 00:34:02.067299
105	54219806	talking_photo	1	0	2026-04-12 00:34:14.624394
106	54219806	copy	1	0	2026-04-12 00:34:24.053452
107	54219806	copy	1	0	2026-04-12 00:42:50.957218
108	54219806	image	1	0	2026-04-12 00:43:25.229811
109	54219806	copy	1	0	2026-04-12 00:43:26.849654
110	54219806	talking_photo	1	0	2026-04-12 00:43:38.009671
111	54219806	talking_photo	1	0	2026-04-12 00:44:05.097854
112	54219806	copy	1	0	2026-04-12 00:51:09.999063
113	54219806	image	1	0	2026-04-12 00:51:51.722557
114	54219806	copy	1	0	2026-04-12 00:51:53.948244
115	54219806	text	1	0	2026-04-12 00:53:12.748656
116	54219806	image	1	0	2026-04-12 01:29:27.836429
117	54219806	image	1	0	2026-04-12 01:30:37.675547
118	54219806	image	1	0	2026-04-12 04:06:04.282099
119	54219806	copy	1	0	2026-04-12 23:11:00.125919
120	54219806	image	1	0	2026-04-12 23:11:39.29544
121	54219806	copy	1	0	2026-04-12 23:11:40.449953
122	54219806	copy	1	0	2026-04-12 23:11:49.045091
123	54219806	copy	1	0	2026-04-12 23:12:20.66967
124	54219806	image	1	0	2026-04-12 23:12:25.668964
125	54219806	copy	1	0	2026-04-12 23:12:26.830231
126	54219806	image	1	0	2026-04-12 23:14:08.166424
127	54219806	copy	1	0	2026-04-13 01:33:33.080024
128	54219806	image	1	0	2026-04-13 01:34:10.799809
129	54219806	copy	1	0	2026-04-13 01:34:12.232514
130	54219806	copy	1	0	2026-04-13 01:35:15.922828
131	54219806	image	1	0	2026-04-13 01:35:51.467707
132	54219806	copy	1	0	2026-04-13 01:35:53.538942
133	54219806	copy	1	0	2026-04-13 01:36:35.167866
134	54219806	copy	1	0	2026-04-13 01:37:21.713903
135	54219806	video_script	1	0	2026-04-13 01:37:26.217119
136	54219806	image	1	0	2026-04-13 01:37:51.184594
137	54219806	image	1	0	2026-04-13 01:39:16.027224
138	54219806	text	1	0	2026-04-13 01:44:16.408513
139	54219806	video_script	1	0	2026-04-13 01:45:17.336076
140	54219806	copy	1	0	2026-04-13 01:45:28.133167
141	54219806	image	1	0	2026-04-13 01:45:31.705041
142	54219806	video_script	1	0	2026-04-13 01:45:44.476539
143	54219806	image	1	0	2026-04-13 02:10:38.973158
144	54219806	text	1	0	2026-04-13 02:13:26.246334
145	54219806	copy	1	0	2026-04-13 02:13:28.416081
146	54219806	video_script	1	0	2026-04-13 02:13:39.801493
147	54219806	text	1	0	2026-04-13 02:13:59.57763
148	54219806	image	1	0	2026-04-13 02:14:23.656177
149	54219806	image	1	0	2026-04-13 17:40:49.64156
150	f1bea370-0eff-4578-9bc0-e9034e32d9fd	copy	1	0	2026-04-13 17:41:49.190519
151	f1bea370-0eff-4578-9bc0-e9034e32d9fd	image	1	0	2026-04-13 17:42:57.132337
152	f1bea370-0eff-4578-9bc0-e9034e32d9fd	copy	1	0	2026-04-13 17:42:59.571297
153	f1bea370-0eff-4578-9bc0-e9034e32d9fd	video_script	1	0	2026-04-13 17:43:24.045828
154	f1bea370-0eff-4578-9bc0-e9034e32d9fd	image	1	0	2026-04-13 17:43:44.973406
155	54219806	copy	1	0	2026-04-14 00:25:40.17538
156	54219806	image	1	0	2026-04-14 00:26:27.534666
157	54219806	copy	1	0	2026-04-14 00:26:30.017649
158	54219806	talking_photo	1	0	2026-04-14 00:26:42.430869
159	54219806	image	1	0	2026-04-14 00:37:13.353132
160	54219806	copy	1	0	2026-04-14 18:07:52.583363
161	54219806	image	1	0	2026-04-14 18:08:40.51509
162	54219806	copy	1	0	2026-04-14 18:08:42.418711
163	54219806	talking_photo	1	0	2026-04-14 18:08:58.093327
164	54219806	copy	1	0	2026-04-14 18:10:22.817551
165	54219806	video_script	1	0	2026-04-14 18:10:49.138657
166	54219806	image	1	0	2026-04-14 18:10:51.426706
167	54219806	image	1	0	2026-04-14 18:23:06.614942
168	54219806	image	1	0	2026-04-14 18:24:20.093881
169	54219806	image	1	0	2026-04-14 18:26:40.668012
170	54219806	image	1	0	2026-04-14 18:27:42.438891
171	54219806	image	1	0	2026-04-14 18:28:09.130211
172	54219806	copy	1	0	2026-04-14 18:30:54.335886
173	54219806	copy	1	0	2026-04-14 18:31:01.777062
174	54219806	presenter_clip	1	0	2026-04-14 18:52:14.352067
175	54219806	presenter_clip	1	0	2026-04-14 18:53:55.00297
176	54219806	presenter_clip	1	0	2026-04-14 19:10:08.58163
177	54219806	image	1	0	2026-04-14 19:12:24.509231
178	54165148	talking_photo	1	0	2026-04-15 22:59:05.143574
179	54165148	image	1	0	2026-04-15 22:59:07.064491
180	54165148	talking_photo	1	0	2026-04-15 22:59:58.22429
181	54165148	talking_photo	1	0	2026-04-15 23:01:25.54033
182	54165148	talking_photo	1	0	2026-04-15 23:02:08.623126
183	54165148	talking_photo	1	0	2026-04-15 23:02:56.591807
184	54165148	image	1	0	2026-04-15 23:04:46.911158
185	54165148	presenter_clip	1	0	2026-04-15 23:05:46.292898
186	54219806	copy	1	0	2026-04-18 14:15:02.415713
187	54219806	image	1	0	2026-04-18 14:15:38.822926
188	54219806	copy	1	0	2026-04-18 14:15:41.176218
189	54219806	presenter_clip	1	0	2026-04-18 14:17:58.989261
190	54219806	video_script	1	0	2026-04-18 14:18:07.073208
\.


--
-- Data for Name: boost_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.boost_orders (id, order_number, ad_id, user_id, amount, payment_ref, status, created_at, payment_screenshot_url, payment_method) FROM stdin;
\.


--
-- Data for Name: channel_subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.channel_subscriptions (id, user_id, channel_id, created_at) FROM stdin;
\.


--
-- Data for Name: channels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.channels (id, user_id, name, description, avatar_url, banner_url, language, category, subscriber_count, views_count, is_verified, is_monetized, status, earnings, created_at, earnings_egp, wallet_number, wallet_type, publisher_code) FROM stdin;
3	56d29356-b8a4-4572-a90d-5e9f99e7713f	مصطفى  Channel	\N	\N	\N	ar	general	2	0	t	f	active	0	2026-03-29 17:05:43.518247	0	\N	\N	PUB-3-0FUB
2	54165148	ahmed Channel	\N	\N	\N	ar	general	1	0	t	f	active	0	2026-03-26 00:41:23.553927	2.5950003	\N	\N	PUB-2-5925
4	b093fdc4-7bde-4f30-bf50-801b6b215217	احمد Channel	\N	\N	\N	ar	general	0	0	f	f	active	0	2026-04-05 21:48:12.982941	0	\N	\N	PUB-4-FUSE
1	54219806	Ahmed Channel	\N	\N	\N	ar	general	1	0	t	f	active	0	2026-03-26 00:32:07.696113	0.0552	\N	\N	PUB-1-NHWE
5	f1bea370-0eff-4578-9bc0-e9034e32d9fd	أحمد  Channel	\N	\N	\N	ar	general	0	0	f	f	active	0	2026-04-13 18:26:58.72542	0	\N	\N	PUB-5-RD2P
\.


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_messages (id, stream_id, user_id, user_name, message, is_hidden, created_at, is_voice) FROM stdin;
1	1	54165148	ahmed	مساء الخير	f	2026-03-26 00:43:16.277554	f
2	1	54219806	Ahmed	https://play.google.com/store/apps/details?id=com.apmo.souqmarket	f	2026-03-26 01:03:31.000187	f
3	2	56d29356-b8a4-4572-a90d-5e9f99e7713f	مصطفى 	السلاام عليكم	f	2026-03-29 17:00:47.59495	f
4	9	54219806	Ahmed	ممتاز	f	2026-03-31 21:37:35.854476	f
5	9	54219806	Ahmed	ممتاز	f	2026-03-31 21:37:44.589295	f
6	9	54219806	Ahmed	جيد	f	2026-03-31 21:38:31.396534	f
7	14	54165148	ahmed mohmed	مساء الخيىر	f	2026-04-05 20:49:03.773527	f
8	17	54165148	ahmed mohmed	السلم عليكم	f	2026-04-05 21:16:33.75148	f
9	19	b093fdc4-7bde-4f30-bf50-801b6b215217	احمد موافي	Hello	f	2026-04-05 21:40:45.354858	f
10	21	b093fdc4-7bde-4f30-bf50-801b6b215217	احمد موافي	Hello my friend	f	2026-04-05 21:43:42.599829	f
11	21	54165148	ahmed mohmed	السلام عليكم ورحمه الله وبركاته	f	2026-04-05 21:44:13.518378	f
12	21	b093fdc4-7bde-4f30-bf50-801b6b215217	احمد موافي	وعليكم السلام ورحمة الله تعالى وبركاته	f	2026-04-05 21:44:31.926234	f
13	28	b093fdc4-7bde-4f30-bf50-801b6b215217	Ahmed Mewafy	Hello	f	2026-04-05 22:02:07.720057	f
14	30	54219806	Ahmed Mohamed	https://05dc59fa-14d7-454e-9429-eb178cf918b9-00-1r3k5c7upc991.spock.replit.dev	f	2026-04-05 22:35:50.034609	f
15	30	54165148	ahmed mohmed	السلام عليكم ورحمه الله وبركاته	f	2026-04-05 22:36:46.069074	f
16	30	54219806	Ahmed Mohamed	https://05dc59fa-14d7-454e-9429-eb178cf918b9-00-1r3k5c7upc991.spock.replit.dev	f	2026-04-05 22:39:22.784985	f
17	31	b093fdc4-7bde-4f30-bf50-801b6b215217	Ahmed Mewafy	Hello	f	2026-04-05 22:44:48.241026	f
18	33	54165148	ahmed mohmed	نتكلم	f	2026-04-05 22:58:34.939654	f
19	33	54219806	Ahmed Mohamed	ممتاز	f	2026-04-05 23:00:57.62961	f
\.


--
-- Data for Name: coin_packages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.coin_packages (id, name, coins, price_egp, bonus_coins, is_active, sort_order, created_at) FROM stdin;
1	باقة صغيرة	100	10	0	t	1	2026-04-07 22:54:12.279662
2	باقة متوسطة	250	22	20	t	2	2026-04-07 22:54:12.279662
3	باقة كبيرة	500	40	75	t	3	2026-04-07 22:54:12.279662
4	باقة مميزة	1000	70	200	t	4	2026-04-07 22:54:12.279662
5	باقة الكنز	3000	180	800	t	5	2026-04-07 22:54:12.279662
\.


--
-- Data for Name: coin_purchase_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.coin_purchase_orders (id, user_id, user_name, package_id, coins, amount_egp, payment_method, payment_ref, screenshot_url, status, admin_note, created_at, reviewed_at, reviewed_by) FROM stdin;
1	db4019e3-eb97-4d90-aac2-4bbe570905b1	محمد محمدود	1	100	10.00	إنستاباي	687iu	\N	approved	\N	2026-04-15 23:15:45.690347	2026-04-15 23:16:34.095604	54219806
2	db4019e3-eb97-4d90-aac2-4bbe570905b1	محمد محمدود	3	575	40.00	إنستاباي	36tr	\N	approved	تم الشحم	2026-04-15 23:17:23.056352	2026-04-15 23:17:55.622385	54219806
\.


--
-- Data for Name: coin_recharge_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.coin_recharge_codes (id, code, coins, price_egp, used_by_user_id, used_at, expires_at, created_at) FROM stdin;
1	SOUQ-3185Y-QGLIW	100	0	\N	\N	\N	2026-04-15 19:48:31.257799
2	SOUQ-UE5N8-5KWPQ	100	0	\N	\N	\N	2026-04-15 19:48:31.333571
3	SOUQ-N0X2B-QZ9BU	100	0	\N	\N	\N	2026-04-15 19:48:31.498409
4	SOUQ-ZEW9P-FV58W	100	0	\N	\N	\N	2026-04-15 19:48:31.500481
5	SOUQ-3HVQ4-6Q1WO	100	0	\N	\N	\N	2026-04-15 19:48:31.503775
6	SOUQ-04KFI-PC7J4	100	0	\N	\N	\N	2026-04-15 19:48:31.506874
7	SOUQ-TPL34-09UTO	100	0	\N	\N	\N	2026-04-15 19:48:31.510208
8	SOUQ-9URMH-Y78YH	100	0	\N	\N	\N	2026-04-15 19:48:31.513328
9	SOUQ-46PHM-02TTB	100	0	\N	\N	\N	2026-04-15 19:48:31.516857
10	SOUQ-Q7ZHS-K9OFF	100	0	\N	\N	\N	2026-04-15 19:48:31.519897
11	SOUQ-YQE7P-K31CN	100	0	\N	\N	\N	2026-04-15 19:50:01.78719
12	SOUQ-AQ2O6-1TB78	100	0	\N	\N	\N	2026-04-15 19:50:01.921859
13	SOUQ-S6J29-NL3UU	100	0	\N	\N	\N	2026-04-15 19:50:01.925514
14	SOUQ-4C064-77F2P	100	0	\N	\N	\N	2026-04-15 19:50:01.929603
15	SOUQ-IT7BT-ZG612	100	0	\N	\N	\N	2026-04-15 19:50:01.931967
16	SOUQ-M9TMM-622AT	100	0	\N	\N	\N	2026-04-15 19:50:01.949745
17	SOUQ-8WOZ2-P0GO5	100	0	\N	\N	\N	2026-04-15 19:50:01.953064
18	SOUQ-FC0QO-DB5IA	100	0	\N	\N	\N	2026-04-15 19:50:01.956407
19	SOUQ-H9SD5-I13Y5	100	0	\N	\N	\N	2026-04-15 19:50:01.969674
20	SOUQ-8ZMCE-6PAET	100	0	\N	\N	\N	2026-04-15 19:50:01.972995
21	SOUQ-ZQC59-8AYSA	100	0	\N	\N	\N	2026-04-15 20:41:47.546068
22	SOUQ-LAFOL-N0CIM	100	0	\N	\N	\N	2026-04-15 20:41:47.558617
23	SOUQ-S57NF-JCIZI	100	0	\N	\N	\N	2026-04-15 20:41:47.56165
24	SOUQ-HVEVJ-UNRZG	100	0	\N	\N	\N	2026-04-15 20:41:47.564469
25	SOUQ-1DIOI-F3MQV	100	0	\N	\N	\N	2026-04-15 20:41:47.566891
26	SOUQ-G80UM-8R451	100	0	\N	\N	\N	2026-04-15 20:41:47.569784
27	SOUQ-JWYSY-T8XG6	100	0	\N	\N	\N	2026-04-15 20:41:47.572225
28	SOUQ-UO3GT-E414O	100	0	\N	\N	\N	2026-04-15 20:41:47.574809
29	SOUQ-D7IKU-5D8Z3	100	0	\N	\N	\N	2026-04-15 20:41:47.577924
30	SOUQ-AQJDU-08NE4	100	0	\N	\N	\N	2026-04-15 20:41:47.580981
31	SOUQ-W2Q4L-90DHK	1000	0	\N	\N	\N	2026-04-17 21:55:31.170481
32	SOUQ-HA8IW-LQC96	1000	0	\N	\N	\N	2026-04-17 21:55:31.18812
33	SOUQ-7EPKH-M56BW	1000	0	\N	\N	\N	2026-04-17 21:55:31.191457
34	SOUQ-QBI0E-JGO54	1000	0	\N	\N	\N	2026-04-17 21:55:31.194179
35	SOUQ-PO2T2-1NKLI	1000	0	\N	\N	\N	2026-04-17 21:55:31.197665
36	SOUQ-QRHXD-MFOIF	1000	0	\N	\N	\N	2026-04-17 21:55:31.201694
37	SOUQ-G5EP4-RK3MM	1000	0	\N	\N	\N	2026-04-17 21:55:31.207434
38	SOUQ-PJR8U-H3XHC	1000	0	\N	\N	\N	2026-04-17 21:55:31.211445
39	SOUQ-PP7LI-9R5DZ	1000	0	\N	\N	\N	2026-04-17 21:55:31.214645
40	SOUQ-2G7NX-M5U5Z	1000	0	\N	\N	\N	2026-04-17 21:55:31.218055
\.


--
-- Data for Name: coin_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.coin_transactions (id, user_id, type, coins, description, related_stream_id, related_user_id, recharge_code_id, created_at) FROM stdin;
1	db4019e3-eb97-4d90-aac2-4bbe570905b1	purchase	100	شراء 100 عملة — إنستاباي — 10.00 ج.م	\N	\N	\N	2026-04-15 23:16:34.091434
2	db4019e3-eb97-4d90-aac2-4bbe570905b1	purchase	575	شراء 575 عملة — إنستاباي — 40.00 ج.م	\N	\N	\N	2026-04-15 23:17:55.618899
3	db4019e3-eb97-4d90-aac2-4bbe570905b1	gift_sent	-5	هدية وردة في البث	46	54165148	\N	2026-04-15 23:20:38.302025
4	54165148	gift_received	3	استلام هدية وردة من محمد محمدود	46	db4019e3-eb97-4d90-aac2-4bbe570905b1	\N	2026-04-15 23:20:38.307491
5	db4019e3-eb97-4d90-aac2-4bbe570905b1	gift_sent	-75	هدية صاروخ في البث	46	54165148	\N	2026-04-15 23:20:57.303173
6	54165148	gift_received	45	استلام هدية صاروخ من محمد محمدود	46	db4019e3-eb97-4d90-aac2-4bbe570905b1	\N	2026-04-15 23:20:57.310489
7	db4019e3-eb97-4d90-aac2-4bbe570905b1	gift_sent	-100	هدية ألماسة في البث	46	54165148	\N	2026-04-15 23:21:02.30449
8	54165148	gift_received	60	استلام هدية ألماسة من محمد محمدود	46	db4019e3-eb97-4d90-aac2-4bbe570905b1	\N	2026-04-15 23:21:02.310492
9	db4019e3-eb97-4d90-aac2-4bbe570905b1	gift_sent	-5	هدية تصفيق في البث	46	54165148	\N	2026-04-15 23:21:07.114836
10	54165148	gift_received	3	استلام هدية تصفيق من محمد محمدود	46	db4019e3-eb97-4d90-aac2-4bbe570905b1	\N	2026-04-15 23:21:07.236441
11	db4019e3-eb97-4d90-aac2-4bbe570905b1	gift_sent	-30	هدية نار في البث	46	54165148	\N	2026-04-15 23:21:11.32318
12	54165148	gift_received	18	استلام هدية نار من محمد محمدود	46	db4019e3-eb97-4d90-aac2-4bbe570905b1	\N	2026-04-15 23:21:11.329306
13	db4019e3-eb97-4d90-aac2-4bbe570905b1	gift_sent	-10	هدية قلب في البث	46	54165148	\N	2026-04-15 23:21:45.765552
14	54165148	gift_received	6	استلام هدية قلب من محمد محمدود	46	db4019e3-eb97-4d90-aac2-4bbe570905b1	\N	2026-04-15 23:21:45.77164
15	db4019e3-eb97-4d90-aac2-4bbe570905b1	gift_sent	-10	هدية قلب في البث	46	54165148	\N	2026-04-15 23:21:47.300314
16	54165148	gift_received	6	استلام هدية قلب من محمد محمدود	46	db4019e3-eb97-4d90-aac2-4bbe570905b1	\N	2026-04-15 23:21:47.305618
17	db4019e3-eb97-4d90-aac2-4bbe570905b1	gift_sent	-10	هدية قلب في البث	46	54165148	\N	2026-04-15 23:21:48.041172
18	54165148	gift_received	6	استلام هدية قلب من محمد محمدود	46	db4019e3-eb97-4d90-aac2-4bbe570905b1	\N	2026-04-15 23:21:48.048131
19	db4019e3-eb97-4d90-aac2-4bbe570905b1	gift_sent	-10	هدية قلب في البث	46	54165148	\N	2026-04-15 23:21:48.249821
20	54165148	gift_received	6	استلام هدية قلب من محمد محمدود	46	db4019e3-eb97-4d90-aac2-4bbe570905b1	\N	2026-04-15 23:21:48.25659
21	db4019e3-eb97-4d90-aac2-4bbe570905b1	gift_sent	-10	هدية قلب في البث	46	54165148	\N	2026-04-15 23:21:48.476609
22	54165148	gift_received	6	استلام هدية قلب من محمد محمدود	46	db4019e3-eb97-4d90-aac2-4bbe570905b1	\N	2026-04-15 23:21:48.483521
\.


--
-- Data for Name: coin_wallets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.coin_wallets (id, user_id, balance, total_spent, total_earned, updated_at) FROM stdin;
2	54219806	0	0	0	2026-04-12 19:25:17.623134
3	f1bea370-0eff-4578-9bc0-e9034e32d9fd	0	0	0	2026-04-13 18:27:14.655431
4	db4019e3-eb97-4d90-aac2-4bbe570905b1	410	265	675	2026-04-15 23:21:48.473178
1	54165148	159	0	159	2026-04-15 23:21:48.480282
\.


--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.comments (id, user_id, user_name, target_type, target_id, content, likes_count, is_hidden, created_at, is_voice_comment, voice_text, is_voice) FROM stdin;
1	54219806	Ahmed	ad	3	ممتاز 	0	f	2026-03-26 00:57:15.72839	f	\N	f
2	54219806	Ahmed	ad	2	ممتاز	0	f	2026-03-26 18:44:03.72963	f	\N	f
3	54219806	Ahmed	ad	6	ممتاز	0	f	2026-03-26 18:56:50.490162	f	\N	f
4	54219806	Ahmed	reel	1	ممتاز	0	f	2026-03-26 20:59:09.188809	f	\N	f
5	54219806	Ahmed	ad	10	اخار الاخبار	0	f	2026-03-27 23:58:04.527635	f	\N	f
6	54165148	ahmed	ad	11	🎤 [تعليق صوتي]	0	f	2026-03-28 00:09:26.030116	f	\N	f
7	54219806	Ahmed	ad	10	ممكن تقلى  احسان الاسعار	0	f	2026-03-28 00:42:47.782317	f	\N	f
8	54165148	ahmed	ad	11	🎤 تعليق صوتي	0	f	2026-03-29 20:59:22.776845	t	/uploads/65206b1f-2b38-4ddf-bc6c-86a4fd7a9ba5.webm	f
9	54165148	ahmed	ad	12	ممكن اعرف الاسعار	0	f	2026-03-29 21:22:20.022106	f	\N	f
10	54219806	Ahmed	ad	48	مشاء الله تبرك الرحمن	0	f	2026-04-03 00:57:15.262984	f	\N	f
11	f1bea370-0eff-4578-9bc0-e9034e32d9fd	أحمد 	ad	47	ممتاز	0	f	2026-04-13 17:33:09.749996	f	\N	f
\.


--
-- Data for Name: consultations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.consultations (id, user_id, user_name, package_id, package_label, amount_egp, title, description, file_urls, status, admin_note, reply, payment_ref, payment_method, payment_screenshot_url, created_at, updated_at) FROM stdin;
1	54219806	Ahmed Mohamed	custom	🛠️ مخصص	0.00	ممكن ارف اعمل اعلان ممول ازى 	ممكن ارف اعمل اعلان ممول ازى 	["/uploads/b13bc7c0-edce-4a2b-8596-58e384f5a228.png"]	pending	\N	\N	\N	\N	\N	2026-04-18 14:40:23.409019	2026-04-18 14:40:23.409019
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conversations (id, title, created_at) FROM stdin;
\.


--
-- Data for Name: coupons; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.coupons (id, user_id, business_name, title, code, discount_type, discount_value, image_url, description, terms_ar, is_active, expires_at, usage_limit, used_count, amount_paid_egp, created_at) FROM stdin;
\.


--
-- Data for Name: direct_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.direct_messages (id, from_user_id, to_user_id, ad_id, message, is_read, created_at, is_voice, voice_url, image_url, is_payment_proof, reply_to_id, reply_to_text) FROM stdin;
1	54165148	54219806	45	🔄 طلب تجديد إعلان\n━━━━━━━━━━━━━━━━━\n📋 رقم الطلب: RNW-1775587474366-45\n📢 رقم الإعلان: #45\n📅 المدة: 30 يوماً\n💰 قيمة الدفع: 50 ج.م\n━━━━━━━━━━━━━━━━━\n⏳ في انتظار تأكيد الدفع...	t	2026-04-07 18:44:34.561815	f	\N	\N	f	\N	\N
2	54219806	54165148	45	✅ تم تأكيد تجديد إعلانك\n━━━━━━━━━━━━━━━━━\n📋 رقم الطلب: RNW-1775587474366-45\n📢 رقم الإعلان: #45\n📅 تم التمديد: 30 يوماً\n💰 المبلغ: 50.00 ج.م\n✅ الحالة: تم الدفع بنجاح ✅\n━━━━━━━━━━━━━━━━━\n🎉 إعلانك الآن نشط — شكراً لثقتك في سوق ماركات 🙏	t	2026-04-07 18:45:17.682567	f	\N	\N	f	\N	\N
3	54219806	54165148	\N	ممتاز	t	2026-04-07 20:58:40.592881	f	\N	\N	f	\N	\N
4	54219806	54219806	47	🔄 طلب تجديد إعلان\n━━━━━━━━━━━━━━━━━\n📋 رقم الطلب: RNW-1775691955871-47\n📢 رقم الإعلان: #47\n📅 المدة: 30 يوماً\n💰 قيمة الدفع: 350 ج.م\n━━━━━━━━━━━━━━━━━\n⏳ في انتظار تأكيد الدفع...	t	2026-04-08 23:45:55.874777	f	\N	\N	f	\N	\N
5	54219806	54219806	62	🔄 طلب تجديد إعلان\n━━━━━━━━━━━━━━━━━\n📋 رقم الطلب: RNW-1775691987952-62\n📢 رقم الإعلان: #62\n📅 المدة: 30 يوماً\n💰 قيمة الدفع: 350 ج.م\n━━━━━━━━━━━━━━━━━\n⏳ في انتظار تأكيد الدفع...	t	2026-04-08 23:46:27.955845	f	\N	\N	f	\N	\N
6	54219806	54219806	47	✅ تم تأكيد تجديد إعلانك\n━━━━━━━━━━━━━━━━━\n📋 رقم الطلب: RNW-1775691955871-47\n📢 رقم الإعلان: #47\n📅 تم التمديد: 30 يوماً\n💰 المبلغ: 350.00 ج.م\n✅ الحالة: تم الدفع بنجاح ✅\n━━━━━━━━━━━━━━━━━\n🎉 إعلانك الآن نشط — شكراً لثقتك في سوق ماركات 🙏	f	2026-04-08 23:48:04.557133	f	\N	\N	f	\N	\N
7	54219806	54219806	62	✅ تم تأكيد تجديد إعلانك\n━━━━━━━━━━━━━━━━━\n📋 رقم الطلب: RNW-1775691987952-62\n📢 رقم الإعلان: #62\n📅 تم التمديد: 30 يوماً\n💰 المبلغ: 350.00 ج.م\n✅ الحالة: تم الدفع بنجاح ✅\n━━━━━━━━━━━━━━━━━\n🎉 إعلانك الآن نشط — شكراً لثقتك في سوق ماركات 🙏	f	2026-04-08 23:48:05.478225	f	\N	\N	f	\N	\N
8	f1bea370-0eff-4578-9bc0-e9034e32d9fd	54165148	61	منتج رائع 	f	2026-04-13 16:06:34.289296	f	\N	\N	f	\N	\N
\.


--
-- Data for Name: favorites; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.favorites (id, user_id, ad_id, created_at) FROM stdin;
1	54165148	9	2026-03-28 00:08:04.84258
2	54165148	10	2026-03-28 00:16:08.996553
3	54219806	11	2026-03-28 01:06:49.857693
5	54165148	11	2026-03-28 04:42:23.622152
6	54165148	45	2026-03-28 05:13:53.640156
7	54219806	45	2026-03-28 14:54:16.539537
8	54219806	12	2026-03-30 19:37:46.897041
9	54219806	9	2026-03-31 14:42:25.074433
12	54219806	8	2026-03-31 21:10:28.923808
13	54219806	47	2026-03-31 22:39:56.324943
14	54219806	7	2026-04-02 17:49:55.714529
15	54219806	48	2026-04-03 00:54:51.748504
16	54219806	57	2026-04-04 01:26:23.282704
17	54219806	49	2026-04-04 03:15:21.737242
18	54165148	12	2026-04-07 19:29:03.62308
19	54219806	62	2026-04-08 23:47:14.737802
20	54219806	69	2026-04-12 00:30:34.943456
21	54219806	75	2026-04-12 19:27:48.415725
22	f1bea370-0eff-4578-9bc0-e9034e32d9fd	80	2026-04-13 17:44:50.602102
23	54219806	76	2026-04-16 14:23:42.600025
24	54219806	82	2026-04-18 14:26:40.640519
\.


--
-- Data for Name: follows; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.follows (id, follower_id, channel_id, created_at) FROM stdin;
1	54219806	2	2026-03-26 01:37:29.718581
3	56d29356-b8a4-4572-a90d-5e9f99e7713f	1	2026-03-29 17:48:26.697396
4	54219806	3	2026-03-31 14:41:10.024141
5	54165148	3	2026-03-31 19:53:17.055492
\.


--
-- Data for Name: fraud_alerts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fraud_alerts (id, campaign_id, ip_address, alert_type, details, created_at) FROM stdin;
1	1	169.150.218.69	impression	self_click_advertiser	2026-03-29 15:02:34.825494
2	1	169.150.218.69	click	self_click_advertiser	2026-03-29 15:02:45.683185
3	1	169.150.218.69	impression	self_click_advertiser	2026-03-29 15:03:05.561511
4	2	169.150.218.69	impression	self_click_advertiser	2026-03-29 15:03:35.719813
5	1	169.150.218.69	impression	self_click_advertiser	2026-03-29 15:04:05.573697
6	2	169.150.218.69	impression	self_click_advertiser	2026-03-29 16:57:20.495561
7	2	169.150.218.69	click	self_click_advertiser	2026-03-29 16:57:24.229225
8	2	169.150.218.69	click	self_click_advertiser	2026-03-29 16:57:40.478905
9	2	169.150.218.69	impression	self_click_advertiser	2026-03-29 16:57:50.515659
10	1	169.150.218.69	impression	self_click_advertiser	2026-03-29 16:57:58.134411
11	1	169.150.218.69	click	self_click_advertiser	2026-03-29 16:58:03.539889
12	1	169.150.218.69	impression	duplicate_impression_5	2026-03-29 17:03:44.293382
13	1	169.150.218.69	impression	duplicate_impression_6	2026-03-29 17:04:04.214136
14	1	169.150.218.69	impression	duplicate_impression_7	2026-03-29 17:04:24.193012
15	1	169.150.218.69	impression	duplicate_impression_8	2026-03-29 17:04:44.170687
16	1	169.150.218.69	impression	duplicate_impression_9	2026-03-29 17:48:17.763325
17	1	169.150.218.69	impression	duplicate_impression_10	2026-03-29 17:48:47.643508
18	1	169.150.218.69	impression	self_click_advertiser	2026-03-29 18:33:40.182087
19	1	169.150.218.69	impression	self_click_advertiser	2026-03-29 18:34:09.329536
20	1	169.150.218.69	impression	self_click_advertiser	2026-03-29 18:34:39.352772
21	2	169.150.218.69	impression	self_click_advertiser	2026-03-29 19:47:49.228703
22	1	169.150.218.69	impression	self_click_advertiser	2026-03-29 19:48:18.342007
23	2	169.150.218.69	impression	self_click_advertiser	2026-03-29 19:48:20.166756
24	2	169.150.218.69	impression	self_click_advertiser	2026-03-29 19:48:40.060742
25	1	169.150.218.69	impression	self_click_advertiser	2026-03-29 19:49:00.08543
26	1	169.150.218.69	impression	self_click_advertiser	2026-03-29 19:49:20.055667
27	2	169.150.218.69	impression	self_click_advertiser	2026-03-29 19:49:40.155867
28	1	169.150.218.69	impression	self_click_advertiser	2026-03-29 19:50:00.171289
29	2	169.150.218.69	impression	self_click_advertiser	2026-03-29 19:50:20.19218
30	2	169.150.218.69	impression	self_click_advertiser	2026-03-29 19:50:40.061188
31	1	169.150.218.69	impression	self_click_advertiser	2026-03-29 19:51:00.219587
32	2	169.150.218.69	impression	self_click_advertiser	2026-03-29 19:51:20.09018
33	1	169.150.218.69	impression	self_click_advertiser	2026-03-29 19:51:40.168728
34	1	156.213.188.30	impression	self_click_advertiser	2026-03-29 23:51:27.93243
35	1	156.213.188.30	impression	self_click_advertiser	2026-03-29 23:51:57.198483
36	2	156.213.188.30	impression	self_click_advertiser	2026-03-29 23:52:27.199014
37	1	156.213.188.30	impression	self_click_advertiser	2026-03-29 23:52:57.193846
38	1	156.213.188.30	impression	self_click_advertiser	2026-03-29 23:53:27.200986
39	2	156.213.188.30	impression	self_click_advertiser	2026-03-29 23:53:57.2105
40	2	156.213.188.30	impression	self_click_advertiser	2026-03-29 23:54:27.181776
41	2	156.213.188.30	impression	self_click_advertiser	2026-03-29 23:54:57.192018
42	2	197.42.144.192	impression	self_click_advertiser	2026-03-30 19:32:03.603398
43	1	197.42.144.192	impression	self_click_advertiser	2026-03-30 19:32:33.60305
44	1	197.42.144.192	impression	self_click_advertiser	2026-03-30 19:33:03.518555
45	1	102.46.47.211	impression	self_click_advertiser	2026-04-01 00:46:41.735544
46	1	102.46.47.211	impression	self_click_advertiser	2026-04-01 00:47:01.650717
47	2	102.46.47.211	impression	self_click_advertiser	2026-04-01 00:47:21.684498
48	2	102.46.47.211	impression	self_click_advertiser	2026-04-01 00:47:42.918343
49	2	102.46.47.211	impression	self_click_advertiser	2026-04-01 00:48:01.684604
50	2	102.46.47.211	impression	self_click_advertiser	2026-04-01 00:48:21.666258
51	1	102.46.47.211	impression	self_click_advertiser	2026-04-01 00:48:41.677686
52	1	102.46.47.211	impression	self_click_advertiser	2026-04-01 00:49:01.656838
53	1	102.46.47.211	impression	self_click_advertiser	2026-04-01 00:49:21.643561
54	2	102.46.47.211	impression	self_click_advertiser	2026-04-01 00:49:41.76392
55	2	102.46.47.211	impression	self_click_advertiser	2026-04-01 00:50:01.709476
56	1	102.46.47.211	impression	self_click_advertiser	2026-04-01 00:50:21.700431
57	2	102.46.47.211	impression	self_click_advertiser	2026-04-01 00:50:41.710223
58	2	102.46.47.211	impression	self_click_advertiser	2026-04-01 00:51:01.977627
59	2	102.46.47.211	impression	self_click_advertiser	2026-04-01 00:51:21.651518
60	2	102.46.47.211	impression	self_click_advertiser	2026-04-01 00:51:41.659638
61	1	156.213.137.179	impression	self_click_advertiser	2026-04-04 03:14:00.337036
62	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:02:22.338824
63	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:02:32.317466
64	2	156.213.137.179	click	self_click_advertiser	2026-04-04 04:02:35.944716
65	1	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:02:52.465914
66	1	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:02:52.644446
67	1	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:04:34.454068
68	1	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:04:38.421015
69	1	156.213.137.179	click	self_click_advertiser	2026-04-04 04:04:40.195939
70	1	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:04:53.449648
71	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:04:53.866037
72	2	156.213.137.179	click	self_click_advertiser	2026-04-04 04:05:02.308754
73	1	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:05:09.132025
74	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:05:24.169434
75	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:05:32.921641
76	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:05:33.146702
77	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:05:39.589933
78	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:06:28.479749
79	2	156.213.137.179	click	self_click_advertiser	2026-04-04 04:06:31.216542
80	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:06:43.52366
81	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:06:59.143569
82	1	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:07:14.15032
83	1	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:07:29.156259
84	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:07:44.181824
85	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:07:59.149418
86	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:08:26.196857
87	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:09:26.240647
88	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:10:26.202102
89	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:11:14.488452
90	1	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:11:18.966066
91	1	156.213.137.179	click	self_click_advertiser	2026-04-04 04:11:33.482452
92	1	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:11:34.116423
93	1	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:11:42.874662
94	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:11:57.903022
95	1	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:12:12.913452
96	1	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:12:27.907142
97	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:12:42.9105
98	1	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:12:58.283339
99	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:13:12.91032
100	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:13:27.902807
101	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:13:42.946547
102	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:13:57.946733
103	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:14:12.935711
104	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:14:27.923126
105	1	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:14:42.907764
106	1	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:14:55.176035
107	1	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:14:55.35673
108	2	156.213.137.179	impression	self_click_advertiser	2026-04-04 04:15:10.341131
109	1	197.52.20.41	impression	duplicate_impression_5	2026-04-07 18:36:19.124498
110	1	197.52.20.41	impression	duplicate_impression_6	2026-04-07 18:36:34.069196
111	1	197.52.20.41	impression	duplicate_impression_7	2026-04-07 18:36:49.126763
112	2	197.52.20.41	impression	duplicate_impression_5	2026-04-07 18:37:04.102118
113	2	197.52.20.41	impression	duplicate_impression_6	2026-04-07 18:37:19.10543
114	2	197.52.20.41	impression	duplicate_impression_7	2026-04-07 18:37:34.126789
115	1	197.52.20.41	impression	duplicate_impression_8	2026-04-07 18:37:49.080625
116	1	197.52.20.41	impression	duplicate_impression_9	2026-04-07 18:38:04.109585
117	2	197.52.20.41	impression	duplicate_impression_8	2026-04-07 18:38:19.089693
118	2	197.52.20.41	impression	duplicate_impression_9	2026-04-07 18:38:34.079757
119	1	197.52.20.41	impression	duplicate_impression_10	2026-04-07 18:38:49.090766
120	1	197.52.20.41	impression	duplicate_impression_11	2026-04-07 18:39:04.084295
121	2	197.52.20.41	impression	duplicate_impression_10	2026-04-07 18:39:19.112498
122	2	197.52.20.41	impression	duplicate_impression_11	2026-04-07 18:39:34.093895
123	1	197.52.20.41	impression	duplicate_impression_12	2026-04-07 18:39:49.082608
124	1	197.52.20.41	impression	duplicate_impression_13	2026-04-07 18:40:04.077461
125	1	197.52.20.41	impression	duplicate_impression_14	2026-04-07 18:40:19.086669
126	1	197.52.20.41	impression	duplicate_impression_15	2026-04-07 18:40:34.081454
127	2	197.52.20.41	impression	duplicate_impression_12	2026-04-07 18:40:49.075223
128	2	197.52.20.41	impression	duplicate_impression_13	2026-04-07 18:41:04.085487
129	2	197.52.20.41	impression	duplicate_impression_14	2026-04-07 18:41:19.079047
130	1	197.52.20.41	impression	duplicate_impression_16	2026-04-07 18:41:34.105648
131	1	197.52.20.41	impression	duplicate_impression_17	2026-04-07 18:41:49.087037
132	1	197.52.20.41	impression	duplicate_impression_18	2026-04-07 18:42:04.081957
133	2	197.52.20.41	impression	duplicate_impression_15	2026-04-07 18:42:19.090632
134	2	197.52.20.41	impression	duplicate_impression_16	2026-04-07 18:42:34.12028
135	2	197.52.20.41	impression	duplicate_impression_17	2026-04-07 18:42:49.083639
136	2	197.52.20.41	impression	duplicate_impression_18	2026-04-07 18:43:04.156957
137	1	197.52.20.41	impression	duplicate_impression_19	2026-04-07 18:43:15.081979
138	1	197.52.20.41	impression	duplicate_impression_20	2026-04-07 18:43:30.095335
139	2	197.52.20.41	impression	self_click_advertiser	2026-04-08 17:54:33.250202
140	1	197.52.20.41	impression	self_click_advertiser	2026-04-08 17:54:40.748194
141	2	197.52.20.41	impression	self_click_advertiser	2026-04-08 17:54:40.951905
142	2	197.52.130.251	impression	duplicate_impression_5	2026-04-13 16:32:21.430547
143	2	197.52.130.251	impression	duplicate_impression_6	2026-04-13 16:33:14.32811
144	2	197.52.130.251	impression	duplicate_impression_7	2026-04-13 16:33:26.483342
145	2	156.213.215.23	impression	self_click_advertiser	2026-04-18 14:31:40.829009
146	2	156.213.215.23	impression	self_click_advertiser	2026-04-18 14:31:44.978082
147	1	156.213.215.23	impression	self_click_advertiser	2026-04-18 14:31:49.57477
\.


--
-- Data for Name: likes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.likes (id, user_id, target_type, target_id, created_at) FROM stdin;
85	54219806	ad	48	2026-04-03 18:19:18.268671
4	54219806	ad	1	2026-03-26 01:03:05.199263
5	54219806	stream	2	2026-03-26 01:37:44.870285
86	54219806	ad	61	2026-04-07 19:34:56.316838
8	54219806	stream	3	2026-03-26 18:32:39.620306
88	54219806	ad	45	2026-04-08 20:22:01.741004
89	54219806	ad	62	2026-04-08 23:47:24.538865
90	54219806	ad	65	2026-04-10 02:05:32.463151
91	54219806	ad	66	2026-04-10 02:32:56.535399
13	54219806	ad	2	2026-03-26 18:43:56.371724
14	54219806	ad	5	2026-03-26 18:52:16.807803
94	f1bea370-0eff-4578-9bc0-e9034e32d9fd	reel	4	2026-04-13 16:32:50.165227
95	f1bea370-0eff-4578-9bc0-e9034e32d9fd	ad	68	2026-04-13 17:32:26.826452
96	f1bea370-0eff-4578-9bc0-e9034e32d9fd	ad	47	2026-04-13 17:32:57.181407
97	54219806	ad	82	2026-04-18 14:22:41.980374
100	54165148	ad	82	2026-04-18 14:46:37.428359
26	54165148	ad	9	2026-03-26 21:55:36.690035
28	54165148	ad	2	2026-03-26 21:56:32.5453
29	54165148	reel	1	2026-03-26 21:57:07.190256
35	54219806	ad	8	2026-03-26 22:15:51.76326
38	54219806	ad	6	2026-03-27 23:39:54.520884
39	54219806	ad	7	2026-03-27 23:55:29.209937
40	54165148	stream	3	2026-03-28 00:01:55.197762
41	54165148	ad	6	2026-03-28 00:14:44.047148
43	54219806	ad	10	2026-03-28 01:35:18.228086
45	54219806	ad	12	2026-03-28 02:01:07.724115
46	54219806	stream	4	2026-03-28 02:04:17.653107
47	54219806	stream	5	2026-03-28 02:15:40.392332
48	54219806	stream	6	2026-03-28 02:27:11.124433
51	54165148	ad	45	2026-03-28 05:23:34.387818
55	54165148	ad	12	2026-03-29 21:21:58.675244
56	54219806	stream	7	2026-03-31 14:43:49.642965
\.


--
-- Data for Name: live_streams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.live_streams (id, channel_id, user_id, title, description, thumbnail_url, category, language, status, viewer_count, peak_viewers, likes_count, chat_enabled, started_at, ended_at, created_at, show_ads, total_earnings_egp, recording_url, stream_key, stream_mode) FROM stdin;
4	1	54219806	احمد 	منتجات تطبيق  سوق ماركات	\N	news	ar	scheduled	1	0	1	t	\N	\N	2026-03-28 02:04:10.830426	t	0	\N	\N	webrtc
5	1	54219806	احم		\N	general	ar	scheduled	1	0	1	t	\N	\N	2026-03-28 02:15:23.744133	t	0	\N	\N	webrtc
8	1	54219806	احمد	بيع	\N	education	ar	scheduled	1	0	0	t	\N	\N	2026-03-31 20:25:12.234011	t	0	\N	\N	webrtc
26	4	b093fdc4-7bde-4f30-bf50-801b6b215217	لا تكذبي 	فنجان قهوه 	\N	general	ar	scheduled	1	0	0	t	\N	\N	2026-04-05 21:55:44.511063	t	0	\N	\N	webrtc
2	2	54165148	تطبيق سوق ماركات 	تطبيق  بيع وشراء وتسويق منتجات الماركت والخضار والفكهة والاجهزه الكهربائية ومنتجات تانية كتير 	\N	general	ar	ended	1	0	1	t	2026-03-26 00:56:42.894	2026-03-31 20:55:31.064	2026-03-26 00:55:05.848414	t	0	\N	\N	webrtc
27	4	b093fdc4-7bde-4f30-bf50-801b6b215217	اجتماعيات 	بركات 	\N	general	ar	scheduled	1	0	0	t	\N	\N	2026-04-05 21:59:19.430274	t	0	\N	\N	webrtc
6	1	54219806	احمد	بيع	\N	general	ar	scheduled	1	0	1	t	\N	\N	2026-03-28 02:26:59.727297	t	0	\N	\N	webrtc
11	2	54165148	احمد	منتجات	\N	general	ar	ended	1	0	0	t	2026-04-02 12:15:03.421	2026-04-02 20:20:40.39	2026-04-02 12:15:00.784428	t	0	\N	\N	webrtc
9	1	54219806	احمد	بيع من تطبيق 	\N	general	ar	scheduled	1	0	0	t	\N	\N	2026-03-31 21:12:19.453238	t	0	\N	\N	webrtc
3	1	54219806	تتنةة	ؤؤؤ	\N	general	ar	scheduled	1	0	2	t	\N	\N	2026-03-26 18:32:32.075715	t	0	\N	\N	webrtc
7	1	54219806	احمد	مصطفى	\N	general	ar	scheduled	1	0	1	t	\N	\N	2026-03-31 14:43:07.142464	t	0	\N	\N	webrtc
28	4	b093fdc4-7bde-4f30-bf50-801b6b215217	Teaching 	Arabic to Non-Native speakers 	\N	general	ar	scheduled	1	0	0	t	\N	\N	2026-04-05 22:01:59.919189	t	0	\N	\N	webrtc
22	4	b093fdc4-7bde-4f30-bf50-801b6b215217	اجتماع 	لقاءات عمل 	\N	general	ar	scheduled	1	0	0	t	\N	\N	2026-04-05 21:48:42.884825	t	0	\N	\N	webrtc
29	4	b093fdc4-7bde-4f30-bf50-801b6b215217	Hello Arabic 	Teaching Arabic to Non-Native speakers 	\N	general	ar	scheduled	1	0	0	t	\N	\N	2026-04-05 22:23:01.392719	t	0	\N	\N	webrtc
24	4	b093fdc4-7bde-4f30-bf50-801b6b215217	تمرات	جيكو	\N	general	ar	scheduled	1	0	0	t	\N	\N	2026-04-05 21:53:44.756239	t	0	\N	\N	webrtc
18	2	54165148	احمد محمود	بيع	\N	general	ar	ended	1	0	0	t	2026-04-05 21:21:48.301	\N	2026-04-05 21:21:46.674937	t	0	\N	\N	webrtc
23	4	b093fdc4-7bde-4f30-bf50-801b6b215217	تحياتي 	الأخبار 	\N	news	ar	scheduled	1	0	0	t	\N	\N	2026-04-05 21:52:33.554311	t	0	\N	\N	webrtc
1	2	54165148	تطبيق سوق ماركات 	تطبيق سوق ماركات هي منصة بيع منتجات علي التطبيق 	\N	general	ar	ended	1	0	0	t	2026-03-26 00:42:19.926	2026-03-31 20:55:23.603	2026-03-26 00:42:16.171668	t	0	\N	\N	webrtc
13	2	54165148	احمد	بيع منتجات	\N	general	ar	ended	1	0	0	t	2026-04-05 20:47:48.804	2026-04-07 22:02:32.184296	2026-04-05 20:45:12.968138	t	0	\N	\N	webrtc
12	1	54219806	احمد	منتجات	\N	gaming	ar	scheduled	1	0	0	t	\N	\N	2026-04-02 14:33:13.260089	t	0	\N	\N	webrtc
35	2	54165148	المقطم ٢	بيع	\N	general	ar	ended	1	0	0	t	2026-04-05 23:47:54.976	\N	2026-04-05 23:47:53.754042	t	0	\N	\N	webrtc
25	2	54165148	احمد احمد	بيع	\N	general	ar	ended	1	0	0	t	2026-04-05 21:54:56.86	\N	2026-04-05 21:54:55.085353	t	0	\N	\N	webrtc
10	2	54165148	احمد عصمت	منتجات	\N	general	ar	ended	1	0	0	t	2026-04-02 12:12:38.948	2026-04-02 20:20:35.488	2026-04-02 12:12:36.507457	t	0	\N	\N	webrtc
14	2	54165148	احمد محمد	بيع منتجات	\N	general	ar	ended	1	0	0	t	2026-04-05 20:48:36.481	2026-04-07 22:02:32.184296	2026-04-05 20:48:35.406394	t	0	\N	\N	webrtc
31	2	54165148	القاهره مصري 	بيع	\N	general	ar	ended	1	0	0	t	2026-04-05 22:44:24.284	\N	2026-04-05 22:42:38.805548	t	0	\N	\N	webrtc
36	2	54165148	المقطم ٢	منتجات	\N	general	ar	ended	1	0	0	t	2026-04-06 00:10:52.752	2026-04-07 22:02:32.184296	2026-04-05 23:54:55.336069	t	0	\N	\N	webrtc
16	2	54165148	احمد محمد 	منتجات	\N	general	ar	ended	1	0	0	t	2026-04-05 21:08:49.605	2026-04-07 22:02:32.184296	2026-04-05 21:08:47.489123	t	0	\N	\N	webrtc
37	2	54165148	مصر	منتجات	\N	general	ar	ended	1	0	0	t	2026-04-06 01:16:45.455	2026-04-07 22:02:32.184296	2026-04-06 01:16:43.902317	t	0	\N	\N	webrtc
19	2	54165148	احمد عصمت  عصمت 	تسويق	\N	general	ar	ended	1	0	0	t	2026-04-05 21:28:28.222	2026-04-07 22:02:32.184296	2026-04-05 21:28:26.783626	t	0	\N	\N	webrtc
20	2	54165148	احمد 	تسويق	\N	general	ar	ended	1	0	0	t	2026-04-05 21:34:56.879	2026-04-07 22:02:32.184296	2026-04-05 21:34:23.655451	t	0	\N	\N	webrtc
34	2	54165148	المقطم	بيع	\N	general	ar	ended	1	0	0	t	2026-04-05 23:44:02.755	2026-04-07 22:02:32.184296	2026-04-05 23:44:01.192565	t	0	\N	\N	webrtc
15	2	54165148	احمد محمد 	منتجات	\N	general	ar	ended	1	0	0	t	2026-04-05 20:49:42.296	2026-04-07 22:02:32.184296	2026-04-05 20:49:40.86934	t	0	\N	\N	webrtc
33	2	54165148	حلون	عصمت	\N	general	ar	ended	1	0	0	t	2026-04-05 22:55:34.033	2026-04-07 22:02:32.184296	2026-04-05 22:55:32.764225	t	0	\N	\N	webrtc
32	2	54165148	الجيز ة	منتجات	\N	general	ar	ended	1	0	0	t	2026-04-05 22:49:42.469	2026-04-07 22:02:32.184296	2026-04-05 22:49:41.115796	t	0	\N	\N	webrtc
17	2	54165148	احمد محمود	بيع منتجات	\N	general	ar	ended	1	0	0	t	2026-04-05 21:14:26.787	2026-04-07 22:02:32.184296	2026-04-05 21:14:25.069714	t	0	\N	\N	webrtc
21	2	54165148	احمد خليفة 	تسويق	\N	general	ar	ended	1	0	0	t	2026-04-05 21:42:05.557	2026-04-07 22:02:32.184296	2026-04-05 21:42:04.367278	t	0	\N	\N	webrtc
30	2	54165148	المصري	منتجات	\N	general	ar	ended	1	0	0	t	2026-04-05 22:29:39.381	2026-04-07 22:02:32.184296	2026-04-05 22:29:37.365184	t	0	\N	\N	webrtc
38	1	54219806	تحمد	تسوق	\N	general	ar	scheduled	1	0	0	t	\N	\N	2026-04-12 19:25:17.203962	t	0	\N	\N	webrtc
47	2	54165148	أحمد 	منتجات	\N	general	ar	ended	1	0	0	t	2026-04-16 04:48:02.047	2026-04-16 17:11:59.143279	2026-04-16 03:49:54.018684	t	0	\N	\N	webrtc
39	5	f1bea370-0eff-4578-9bc0-e9034e32d9fd	احمد موافي 	تعليم 	\N	general	ar	scheduled	1	0	0	t	\N	\N	2026-04-13 18:27:14.303924	t	0	\N	\N	webrtc
40	5	f1bea370-0eff-4578-9bc0-e9034e32d9fd	احمد موافي 	تعليم	\N	general	ar	scheduled	1	0	0	t	\N	\N	2026-04-13 18:28:23.542333	t	0	\N	\N	webrtc
42	5	f1bea370-0eff-4578-9bc0-e9034e32d9fd	محاضرات 	تعلم معنا 	\N	general	ar	scheduled	1	0	0	t	\N	\N	2026-04-13 18:33:39.384939	t	0	\N	\N	webrtc
43	5	f1bea370-0eff-4578-9bc0-e9034e32d9fd	احمد موافي 	منتجات	\N	general	ar	scheduled	1	0	0	t	\N	\N	2026-04-13 18:34:56.463707	t	0	\N	\N	webrtc
41	5	f1bea370-0eff-4578-9bc0-e9034e32d9fd	تعلم 	درس مجانا 	\N	general	ar	scheduled	1	0	0	t	\N	\N	2026-04-13 18:32:46.615029	t	0	\N	\N	webrtc
46	2	54165148	احمد عصمت 	منتجات	\N	general	ar	ended	1	0	0	t	2026-04-15 23:12:53.523	2026-04-16 14:11:59.13509	2026-04-15 23:12:40.906872	t	0	\N	\N	webrtc
44	2	54165148	احمد 	منتجات	\N	general	ar	ended	1	0	0	t	2026-04-15 22:36:46.058	2026-04-16 14:11:59.13509	2026-04-15 22:02:00.79998	t	0	\N	\N	webrtc
45	2	54165148	احمد 	صورة	\N	general	ar	ended	1	0	0	t	2026-04-15 23:07:15.07	2026-04-16 14:11:59.13509	2026-04-15 23:07:12.655928	t	0	\N	\N	webrtc
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.messages (id, conversation_id, role, content, created_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, type, title, body, link, is_read, created_at, voice_url, sender_user_id) FROM stdin;
2	54219806	like	إعجاب جديد ❤️	ahmed أعجب بمحتواك	/ads/9	f	2026-03-26 21:55:36.701764	\N	\N
4	541ad010-4694-4b7b-8574-63c29da5320c	like	إعجاب جديد ❤️	ahmed أعجب بمحتواك	/ads/2	f	2026-03-26 21:56:32.55221	\N	\N
5	54219806	like	إعجاب جديد ❤️	ahmed أعجب بمحتواك	/reels	f	2026-03-26 21:57:07.196251	\N	\N
6	54219806	like	إعجاب جديد ❤️	ahmed أعجب بمحتواك	/streams/3	f	2026-03-28 00:01:55.205188	\N	\N
28	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من Ahmed	✨ "النزاع العالمي: إيران، أمريكا، ودولة الاحتلال" — عرض مميز لا تفوّته!	/ads/10	f	2026-03-29 23:54:25.971247	\N	\N
8	54219806	like	إعجاب جديد ❤️	ahmed أعجب بمحتواك	/ads/6	t	2026-03-28 00:14:44.062387	\N	\N
29	54165148	system	🚀 إعلان مميز من Ahmed	✨ "النزاع العالمي: إيران، أمريكا، ودولة الاحتلال" — عرض مميز لا تفوّته!	/ads/10	f	2026-03-29 23:54:25.990168	\N	\N
3	54219806	like	إعجاب جديد ❤️	ahmed أعجب بمحتواك	/ads/8	t	2026-03-26 21:55:41.068082	\N	\N
41	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"سوق ماركات - تطبيق يحول تسوقك لتجربة سينمائية!" — شاهد الإعلان الآن	/ads/47	f	2026-03-31 22:37:03.363855	\N	\N
30	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من Ahmed	✨ "النزاع العالمي: إيران، أمريكا، ودولة الاحتلال" — عرض مميز لا تفوّته!	/ads/10	f	2026-03-29 23:54:25.996339	\N	\N
11	54219806	system	🆕 إعلان جديد من ahmed	"إصنع صورة أسطورية لعيب الكرة!" — شاهد الإعلان الآن	/ads/45	t	2026-03-28 05:11:49.200864	\N	\N
10	54219806	like	إعجاب جديد ❤️	ahmed أعجب بمحتواك	/ads/11	t	2026-03-28 04:51:49.1838	\N	\N
9	54219806	like	إعجاب جديد ❤️	ahmed أعجب بمحتواك	/ads/12	t	2026-03-28 04:40:04.844057	\N	\N
1	54219806	like	إعجاب جديد ❤️	ahmed أعجب بمحتواك	/ads/11	t	2026-03-26 21:54:37.986266	\N	\N
15	54219806	comment	🎤 تعليق صوتي جديد	ahmed: أرسل تعليقاً صوتياً	/ads/11	f	2026-03-29 20:59:22.785059	/uploads/65206b1f-2b38-4ddf-bc6c-86a4fd7a9ba5.webm	54165148
13	54165148	like	إعجاب جديد ❤️	Ahmed أعجب بمحتواك	/reels	t	2026-03-28 15:53:01.335258	\N	\N
14	54165148	like	إعجاب جديد ❤️	Ahmed أعجب بمحتواك	/reels	t	2026-03-28 15:53:02.313882	\N	\N
17	54219806	like	إعجاب جديد ❤️	ahmed أعجب بمحتواك	/ads/12	f	2026-03-29 21:21:58.681238	\N	\N
16	54219806	like	إعجاب جديد ❤️	ahmed أعجب بمحتواك	/ads/12	t	2026-03-29 21:21:57.342976	\N	\N
19	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من Ahmed	✨ "منتجات نسلة" — عرض مميز لا تفوّته!	/ads/7	f	2026-03-29 23:51:42.623057	\N	\N
20	54165148	system	🚀 إعلان مميز من Ahmed	✨ "منتجات نسلة" — عرض مميز لا تفوّته!	/ads/7	f	2026-03-29 23:51:42.631293	\N	\N
21	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من Ahmed	✨ "منتجات نسلة" — عرض مميز لا تفوّته!	/ads/7	f	2026-03-29 23:51:42.644651	\N	\N
22	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من Ahmed	✨ "الإعلان السينمائي لهاتف Samsung Galaxy A26" — عرض مميز لا تفوّته!	/ads/6	f	2026-03-29 23:51:49.42892	\N	\N
23	54165148	system	🚀 إعلان مميز من Ahmed	✨ "الإعلان السينمائي لهاتف Samsung Galaxy A26" — عرض مميز لا تفوّته!	/ads/6	f	2026-03-29 23:51:49.431854	\N	\N
24	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من Ahmed	✨ "الإعلان السينمائي لهاتف Samsung Galaxy A26" — عرض مميز لا تفوّته!	/ads/6	f	2026-03-29 23:51:49.436554	\N	\N
25	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من Ahmed	✨ "رحلة الطعم العميقة – عصير  وحليب جهينة" — عرض مميز لا تفوّته!	/ads/8	f	2026-03-29 23:51:52.531546	\N	\N
26	54165148	system	🚀 إعلان مميز من Ahmed	✨ "رحلة الطعم العميقة – عصير  وحليب جهينة" — عرض مميز لا تفوّته!	/ads/8	f	2026-03-29 23:51:52.533962	\N	\N
27	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من Ahmed	✨ "رحلة الطعم العميقة – عصير  وحليب جهينة" — عرض مميز لا تفوّته!	/ads/8	f	2026-03-29 23:51:52.538885	\N	\N
31	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من Ahmed	✨ "تطبيق سوق ماركات" — عرض مميز لا تفوّته!	/ads/11	f	2026-03-29 23:54:31.32023	\N	\N
32	54165148	system	🚀 إعلان مميز من Ahmed	✨ "تطبيق سوق ماركات" — عرض مميز لا تفوّته!	/ads/11	f	2026-03-29 23:54:31.324322	\N	\N
33	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من Ahmed	✨ "تطبيق سوق ماركات" — عرض مميز لا تفوّته!	/ads/11	f	2026-03-29 23:54:31.331079	\N	\N
34	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من Ahmed	✨ "تطبيق سوق ماركات - اختياراتك أولًا!" — عرض مميز لا تفوّته!	/ads/12	f	2026-03-29 23:54:33.619251	\N	\N
35	54165148	system	🚀 إعلان مميز من Ahmed	✨ "تطبيق سوق ماركات - اختياراتك أولًا!" — عرض مميز لا تفوّته!	/ads/12	f	2026-03-29 23:54:33.622059	\N	\N
36	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من Ahmed	✨ "تطبيق سوق ماركات - اختياراتك أولًا!" — عرض مميز لا تفوّته!	/ads/12	f	2026-03-29 23:54:33.626876	\N	\N
37	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من Ahmed	✨ "لحظتك مع سن تواب" — عرض مميز لا تفوّته!	/ads/9	f	2026-03-29 23:54:36.413435	\N	\N
38	54165148	system	🚀 إعلان مميز من Ahmed	✨ "لحظتك مع سن تواب" — عرض مميز لا تفوّته!	/ads/9	f	2026-03-29 23:54:36.416947	\N	\N
39	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من Ahmed	✨ "لحظتك مع سن تواب" — عرض مميز لا تفوّته!	/ads/9	f	2026-03-29 23:54:36.421575	\N	\N
40	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"سوق ماركات – تسوّق عالمي بكل سهولة" — شاهد الإعلان الآن	/ads/46	f	2026-03-29 23:59:20.529832	\N	\N
7	54219806	comment	تعليق جديد 💬	ahmed: 🎤 [تعليق صوتي]	/ads/11	t	2026-03-28 00:09:26.038396	\N	\N
12	54219806	system	🚀 ahmed يعزز إعلانه!	"إصنع صورة أسطورية لعيب الكرة!" — لا تفوّته!	/ads/45	t	2026-03-28 05:12:10.489814	\N	\N
42	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد عصمت" — شاهد الآن	/streams/10	f	2026-04-02 12:12:38.958872	\N	\N
18	54219806	comment	تعليق جديد 💬	ahmed: ممكن اعرف الاسعار	/ads/12	t	2026-03-29 21:22:20.028971	\N	\N
44	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"صوت جميل " — شاهد الإعلان الآن	/ads/48	f	2026-04-03 00:50:34.166855	\N	\N
43	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد" — شاهد الآن	/streams/11	t	2026-04-02 12:15:03.4306	\N	\N
45	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من Ahmed	✨ "iPhone 15 Pro Max — 256GB أزرق تيتانيوم" — عرض مميز لا تفوّته!	/ads/49	f	2026-04-04 03:14:40.718308	\N	\N
46	54165148	system	🚀 إعلان مميز من Ahmed	✨ "iPhone 15 Pro Max — 256GB أزرق تيتانيوم" — عرض مميز لا تفوّته!	/ads/49	f	2026-04-04 03:14:40.728033	\N	\N
47	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من Ahmed	✨ "iPhone 15 Pro Max — 256GB أزرق تيتانيوم" — عرض مميز لا تفوّته!	/ads/49	f	2026-04-04 03:14:40.743495	\N	\N
48	54165148	system	اشاء اعلان الان بزكاء الصناعى فة 2دقيقة	انشاء الاعلانات الان بقى اسهل  من منصة  ads-as.com	\N	f	2026-04-04 19:13:05.502242	\N	\N
50	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	اشاء اعلان الان بزكاء الصناعى فة 2دقيقة	انشاء الاعلانات الان بقى اسهل  من منصة  ads-as.com	\N	f	2026-04-04 19:13:05.54028	\N	\N
51	541ad010-4694-4b7b-8574-63c29da5320c	system	اشاء اعلان الان بزكاء الصناعى فة 2دقيقة	انشاء الاعلانات الان بقى اسهل  من منصة  ads-as.com	\N	f	2026-04-04 19:13:05.546458	\N	\N
52	54165148	system	🚀 إعلان مميز من Ahmed	✨ "موتوسيكل هوندا CB300R 2023 — جديد" — عرض مميز لا تفوّته!	/ads/55	f	2026-04-04 19:19:59.387035	\N	\N
53	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من Ahmed	✨ "موتوسيكل هوندا CB300R 2023 — جديد" — عرض مميز لا تفوّته!	/ads/55	f	2026-04-04 19:19:59.39737	\N	\N
54	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من Ahmed	✨ "موتوسيكل هوندا CB300R 2023 — جديد" — عرض مميز لا تفوّته!	/ads/55	f	2026-04-04 19:19:59.404887	\N	\N
49	54219806	system	اشاء اعلان الان بزكاء الصناعى فة 2دقيقة	انشاء الاعلانات الان بقى اسهل  من منصة  ads-as.com	\N	t	2026-04-04 19:13:05.520448	\N	\N
55	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد" — شاهد الآن	/streams/13	f	2026-04-05 20:45:19.602637	\N	\N
56	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد" — شاهد الآن	/streams/13	f	2026-04-05 20:47:48.813558	\N	\N
57	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد محمد" — شاهد الآن	/streams/14	f	2026-04-05 20:48:36.488493	\N	\N
58	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد محمد " — شاهد الآن	/streams/15	f	2026-04-05 20:49:42.30178	\N	\N
59	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد محمد " — شاهد الآن	/streams/16	f	2026-04-05 21:08:49.618739	\N	\N
60	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد محمود" — شاهد الآن	/streams/17	f	2026-04-05 21:14:26.802447	\N	\N
61	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد محمود" — شاهد الآن	/streams/18	f	2026-04-05 21:21:48.316003	\N	\N
62	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد عصمت  عصمت " — شاهد الآن	/streams/19	f	2026-04-05 21:28:28.228556	\N	\N
63	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد " — شاهد الآن	/streams/20	f	2026-04-05 21:34:24.891214	\N	\N
64	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد " — شاهد الآن	/streams/20	f	2026-04-05 21:34:56.886468	\N	\N
65	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد خليفة " — شاهد الآن	/streams/21	f	2026-04-05 21:42:05.564432	\N	\N
66	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد احمد" — شاهد الآن	/streams/25	f	2026-04-05 21:54:56.865945	\N	\N
67	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"المصري" — شاهد الآن	/streams/30	f	2026-04-05 22:29:39.393094	\N	\N
68	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"القاهره مصري " — شاهد الآن	/streams/31	f	2026-04-05 22:42:40.70353	\N	\N
69	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"القاهره مصري " — شاهد الآن	/streams/31	f	2026-04-05 22:43:50.954883	\N	\N
70	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"القاهره مصري " — شاهد الآن	/streams/31	f	2026-04-05 22:44:24.28986	\N	\N
71	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"الجيز ة" — شاهد الآن	/streams/32	f	2026-04-05 22:49:42.482604	\N	\N
72	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"حلون" — شاهد الآن	/streams/33	f	2026-04-05 22:55:34.040015	\N	\N
73	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"المقطم" — شاهد الآن	/streams/34	f	2026-04-05 23:44:02.772652	\N	\N
74	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"المقطم ٢" — شاهد الآن	/streams/35	f	2026-04-05 23:47:54.985755	\N	\N
75	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"المقطم ٢" — شاهد الآن	/streams/36	f	2026-04-05 23:54:56.528585	\N	\N
77	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"المقطم ٢" — شاهد الآن	/streams/36	f	2026-04-06 00:04:15.590396	\N	\N
78	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"المقطم ٢" — شاهد الآن	/streams/36	f	2026-04-06 00:10:52.770474	\N	\N
76	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"المقطم ٢" — شاهد الآن	/streams/36	t	2026-04-05 23:55:23.280678	\N	\N
80	54219806	system	🔄 طلب تجديد إعلان #45	رقم الطلب: RNW-1775587474366-45 — 30 يوماً مقابل 50 ج.م	/admin	f	2026-04-07 18:44:34.564745	\N	\N
81	54165148	system	✅ تم تجديد إعلانك	رقم الطلب RNW-1775587474366-45 — إعلانك نشط لـ 30 يوماً إضافية	/ads/45	t	2026-04-07 18:45:17.685116	\N	\N
82	54219806	system	🆕 إعلان جديد من ahmed	"عروض تقسيط حصرية من سوق ماركت" — شاهد الإعلان الآن	/ads/61	f	2026-04-07 19:34:14.437705	\N	\N
83	54165148	like	إعجاب جديد ❤️	Ahmed أعجب بمحتواك	/ads/61	f	2026-04-07 19:34:56.325371	\N	\N
84	b093fdc4-7bde-4f30-bf50-801b6b215217	system	🚀 إعلان مميز من ahmed	✨ "عروض تقسيط حصرية من سوق ماركت" — عرض مميز لا تفوّته!	/ads/61	f	2026-04-07 19:59:37.732209	\N	\N
79	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"مصر" — شاهد الآن	/streams/37	t	2026-04-06 01:16:45.472178	\N	\N
86	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من ahmed	✨ "عروض تقسيط حصرية من سوق ماركت" — عرض مميز لا تفوّته!	/ads/61	f	2026-04-07 19:59:37.749298	\N	\N
87	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من ahmed	✨ "عروض تقسيط حصرية من سوق ماركت" — عرض مميز لا تفوّته!	/ads/61	f	2026-04-07 19:59:37.757878	\N	\N
88	b093fdc4-7bde-4f30-bf50-801b6b215217	system	🚀 إعلان مميز من Ahmed	✨ "صوت جميل" — عرض مميز لا تفوّته!	/ads/48	f	2026-04-07 20:43:44.683165	\N	\N
89	54165148	system	🚀 إعلان مميز من Ahmed	✨ "صوت جميل" — عرض مميز لا تفوّته!	/ads/48	f	2026-04-07 20:43:44.688624	\N	\N
90	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من Ahmed	✨ "صوت جميل" — عرض مميز لا تفوّته!	/ads/48	f	2026-04-07 20:43:44.695053	\N	\N
91	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من Ahmed	✨ "صوت جميل" — عرض مميز لا تفوّته!	/ads/48	f	2026-04-07 20:43:44.699476	\N	\N
85	54219806	system	🚀 إعلان مميز من ahmed	✨ "عروض تقسيط حصرية من سوق ماركت" — عرض مميز لا تفوّته!	/ads/61	t	2026-04-07 19:59:37.740079	\N	\N
93	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"عوض وخصومات من تطبيق سوق ماركات" — شاهد الإعلان الآن	/ads/62	f	2026-04-08 01:17:16.72253	\N	\N
92	54165148	comment	رسالة جديدة 📩	Ahmed: ممتاز	/messages	t	2026-04-07 20:58:40.599818	\N	54219806
94	54165148	payment	✅ تم تفعيل خدمتك!	تم تفعيل خدمة "renewal_30" — رقم الطلب: ORD-20260408-3479	/payments	f	2026-04-08 02:34:24.294834	\N	\N
96	54165148	like	إعجاب جديد ❤️	Ahmed أعجب بمحتواك	/ads/45	f	2026-04-08 20:22:01.748426	\N	\N
97	54165148	system	🚀 إعلان مميز من Ahmed	✨ "سوق ماركات - تطبيق يحول تسوقك لتجربة فريدة من التسوق" — عرض مميز لا تفوّته!	/ads/47	f	2026-04-08 23:45:34.119529	\N	\N
98	b093fdc4-7bde-4f30-bf50-801b6b215217	system	🚀 إعلان مميز من Ahmed	✨ "سوق ماركات - تطبيق يحول تسوقك لتجربة فريدة من التسوق" — عرض مميز لا تفوّته!	/ads/47	f	2026-04-08 23:45:34.13493	\N	\N
99	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من Ahmed	✨ "سوق ماركات - تطبيق يحول تسوقك لتجربة فريدة من التسوق" — عرض مميز لا تفوّته!	/ads/47	f	2026-04-08 23:45:34.141506	\N	\N
100	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من Ahmed	✨ "سوق ماركات - تطبيق يحول تسوقك لتجربة فريدة من التسوق" — عرض مميز لا تفوّته!	/ads/47	f	2026-04-08 23:45:34.235267	\N	\N
101	54219806	system	🔄 طلب تجديد إعلان #47	رقم الطلب: RNW-1775691955871-47 — 30 يوماً مقابل 350 ج.م	/admin	f	2026-04-08 23:45:55.879917	\N	\N
102	54219806	system	🔄 طلب تجديد إعلان #62	رقم الطلب: RNW-1775691987952-62 — 30 يوماً مقابل 350 ج.م	/admin	t	2026-04-08 23:46:27.959231	\N	\N
103	54219806	system	✅ تم تجديد إعلانك	رقم الطلب RNW-1775691955871-47 — إعلانك نشط لـ 30 يوماً إضافية	/ads/47	f	2026-04-08 23:48:04.559981	\N	\N
104	54219806	system	✅ تم تجديد إعلانك	رقم الطلب RNW-1775691987952-62 — إعلانك نشط لـ 30 يوماً إضافية	/ads/62	f	2026-04-08 23:48:05.481492	\N	\N
105	54165148	system	🚀 إعلان مميز من Ahmed	✨ "عروض وخصومات من تطبيق سوق ماركات" — عرض مميز لا تفوّته!	/ads/62	f	2026-04-09 20:21:26.750513	\N	\N
106	b093fdc4-7bde-4f30-bf50-801b6b215217	system	🚀 إعلان مميز من Ahmed	✨ "عروض وخصومات من تطبيق سوق ماركات" — عرض مميز لا تفوّته!	/ads/62	f	2026-04-09 20:21:26.770948	\N	\N
107	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من Ahmed	✨ "عروض وخصومات من تطبيق سوق ماركات" — عرض مميز لا تفوّته!	/ads/62	f	2026-04-09 20:21:26.776757	\N	\N
108	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من Ahmed	✨ "عروض وخصومات من تطبيق سوق ماركات" — عرض مميز لا تفوّته!	/ads/62	f	2026-04-09 20:21:26.779901	\N	\N
95	54165148	payment	✅ تم قبول طلب الدفع وتفعيل الخدمة	رقم الطلب ORD-20260408-3479 — تمت الموافقة وتفعيل الخدمة تلقائياً	/payments	t	2026-04-08 02:34:24.312495	\N	\N
109	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"انشر إعلانك في ثواني وخلي الذكاء الاصطناعي يجيب لك عملاء" — شاهد الإعلان الآن	/ads/63	f	2026-04-10 00:12:08.635959	\N	\N
110	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"منصة إعلانات ذكية تساعدك تبيع منتجاتك بسرعة" — شاهد الإعلان الآن	/ads/64	f	2026-04-10 00:21:56.856931	\N	\N
111	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"👉 أول منصة إعلانات ذكية في مصر اللي بتعمل لك كل ده تلقائي 👇" — شاهد الإعلان الآن	/ads/65	f	2026-04-10 01:46:33.361498	\N	\N
112	54165148	system	📍 إعلان جديد في الدقهلية	"👉 أول منصة إعلانات ذكية في مصر اللي بتعمل لك كل ده تلقائي 👇" — شاهد الإعلان الآن	/ads/65	f	2026-04-10 01:46:33.368927	\N	\N
113	54165148	system	🚀 إعلان مميز من Ahmed	✨ "👉 أول منصة إعلانات ذكية في مصر اللي بتعمل لك كل ده تلقائي 👇" — عرض مميز لا تفوّته!	/ads/65	f	2026-04-10 02:06:12.518266	\N	\N
114	b093fdc4-7bde-4f30-bf50-801b6b215217	system	🚀 إعلان مميز من Ahmed	✨ "👉 أول منصة إعلانات ذكية في مصر اللي بتعمل لك كل ده تلقائي 👇" — عرض مميز لا تفوّته!	/ads/65	f	2026-04-10 02:06:12.536358	\N	\N
115	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من Ahmed	✨ "👉 أول منصة إعلانات ذكية في مصر اللي بتعمل لك كل ده تلقائي 👇" — عرض مميز لا تفوّته!	/ads/65	f	2026-04-10 02:06:12.544939	\N	\N
116	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من Ahmed	✨ "👉 أول منصة إعلانات ذكية في مصر اللي بتعمل لك كل ده تلقائي 👇" — عرض مميز لا تفوّته!	/ads/65	f	2026-04-10 02:06:12.548181	\N	\N
117	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"إعلانك الذكي اللي بيجيب عملاء حقيقيين في ثواني" — شاهد الإعلان الآن	/ads/66	f	2026-04-10 02:30:51.704804	\N	\N
118	54165148	system	💡 إعلان يناسب اهتماماتك من Ahmed	"إعلانك الذكي اللي بيجيب عملاء حقيقيين في ثواني" — شاهد الإعلان الآن	/ads/66	f	2026-04-10 02:30:51.740479	\N	\N
119	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"عوض وخصومات من تطبيق سوق ماركات" — شاهد الإعلان الآن	/ads/67	f	2026-04-11 22:41:59.549803	\N	\N
120	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"شبكة سوق للإعلانات — بيع واشتري في ثوانٍ" — شاهد الإعلان الآن	/ads/68	f	2026-04-11 23:27:12.097451	\N	\N
121	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"شبكة سوق للإعلانات — منصتك للبيع والشراء" — شاهد الإعلان الآن	/ads/69	f	2026-04-11 23:57:39.818778	\N	\N
122	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"شبكة سوق للإعلانات - بيع وشراء بسهولة" — شاهد الإعلان الآن	/ads/70	f	2026-04-12 00:09:43.548973	\N	\N
123	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"شبكة سوق للإعلانات - بيع وشراء بسهولة" — شاهد الإعلان الآن	/ads/71	f	2026-04-12 00:09:43.957292	\N	\N
124	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"سوقك المثالي للإعلانات في مصر" — شاهد الإعلان الآن	/ads/72	f	2026-04-12 00:35:00.332457	\N	\N
125	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"سوقك المثالي للإعلانات في مصر" — شاهد الإعلان الآن	/ads/73	f	2026-04-12 00:35:00.520935	\N	\N
126	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"سوق الإعلانات الأفضل لكل المصريين" — شاهد الإعلان الآن	/ads/74	f	2026-04-12 00:44:33.567961	\N	\N
127	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"سوقك المفتوح لكل المحافظات المصرية!" — شاهد الإعلان الآن	/ads/75	f	2026-04-12 00:53:18.501816	\N	\N
128	54165148	system	🚀 إعلان مميز من Ahmed	✨ "منصة  سوق الاعلانات  بزكاء  الصناعى الان  بين ايدك" — عرض مميز لا تفوّته!	/ads/75	f	2026-04-12 19:27:13.612257	\N	\N
129	b093fdc4-7bde-4f30-bf50-801b6b215217	system	🚀 إعلان مميز من Ahmed	✨ "منصة  سوق الاعلانات  بزكاء  الصناعى الان  بين ايدك" — عرض مميز لا تفوّته!	/ads/75	f	2026-04-12 19:27:13.63285	\N	\N
130	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من Ahmed	✨ "منصة  سوق الاعلانات  بزكاء  الصناعى الان  بين ايدك" — عرض مميز لا تفوّته!	/ads/75	f	2026-04-12 19:27:13.636477	\N	\N
131	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من Ahmed	✨ "منصة  سوق الاعلانات  بزكاء  الصناعى الان  بين ايدك" — عرض مميز لا تفوّته!	/ads/75	f	2026-04-12 19:27:13.640992	\N	\N
132	54219806	system	✅ تم تأكيد دفعك	تم تأكيد دفعك بمبلغ 200.00 ج.م عبر InstaPay للإعلان: منصة  سوق الاعلانات  بزكاء  الصناعى الان  بين ايدك	/ads/75	f	2026-04-12 22:16:42.204079	\N	\N
133	54219806	payment	✅ تم تفعيل خدمتك!	تم تفعيل خدمة "campaign" — رقم الطلب: ORD-20260412-6305	/payments	f	2026-04-12 22:21:17.050892	\N	\N
134	54219806	payment	✅ تم قبول طلب الدفع وتفعيل الخدمة	رقم الطلب ORD-20260412-6305 — تمت الموافقة وتفعيل الخدمة تلقائياً	/payments	f	2026-04-12 22:21:17.059999	\N	\N
135	54219806	payment	✅ تم تفعيل خدمتك!	تم تفعيل خدمة "ai_video" — رقم الطلب: ORD-20260412-1509	/payments	f	2026-04-12 23:00:40.730403	\N	\N
137	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"إعمل إعلانك بإيدك في دقيقة!" — شاهد الإعلان الآن	/ads/76	f	2026-04-12 23:12:40.257619	\N	\N
138	54165148	system	📍 إعلان جديد في الدقهلية	"إعمل إعلانك بإيدك في دقيقة!" — شاهد الإعلان الآن	/ads/76	f	2026-04-12 23:12:40.261809	\N	\N
136	54219806	payment	✅ تم قبول طلب الدفع وتفعيل الخدمة	رقم الطلب ORD-20260412-1509 — تمت الموافقة وتفعيل الخدمة تلقائياً	/payments	t	2026-04-12 23:00:40.739284	\N	\N
139	54165148	system	🚀 إعلان مميز من Ahmed	✨ "منصة  سوق الاعلانات  بزكاء  الصناعى الان  بين ايدك" — عرض مميز لا تفوّته!	/ads/75	f	2026-04-13 00:42:24.111794	\N	\N
140	b093fdc4-7bde-4f30-bf50-801b6b215217	system	🚀 إعلان مميز من Ahmed	✨ "منصة  سوق الاعلانات  بزكاء  الصناعى الان  بين ايدك" — عرض مميز لا تفوّته!	/ads/75	f	2026-04-13 00:42:24.119876	\N	\N
141	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من Ahmed	✨ "منصة  سوق الاعلانات  بزكاء  الصناعى الان  بين ايدك" — عرض مميز لا تفوّته!	/ads/75	f	2026-04-13 00:42:24.123142	\N	\N
142	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من Ahmed	✨ "منصة  سوق الاعلانات  بزكاء  الصناعى الان  بين ايدك" — عرض مميز لا تفوّته!	/ads/75	f	2026-04-13 00:42:24.12649	\N	\N
143	54165148	system	🚀 إعلان مميز من Ahmed	✨ "إعمل إعلانك بإيدك في دقيقة!" — عرض مميز لا تفوّته!	/ads/76	f	2026-04-13 00:43:05.101003	\N	\N
144	b093fdc4-7bde-4f30-bf50-801b6b215217	system	🚀 إعلان مميز من Ahmed	✨ "إعمل إعلانك بإيدك في دقيقة!" — عرض مميز لا تفوّته!	/ads/76	f	2026-04-13 00:43:05.107084	\N	\N
145	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من Ahmed	✨ "إعمل إعلانك بإيدك في دقيقة!" — عرض مميز لا تفوّته!	/ads/76	f	2026-04-13 00:43:05.112273	\N	\N
146	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من Ahmed	✨ "إعمل إعلانك بإيدك في دقيقة!" — عرض مميز لا تفوّته!	/ads/76	f	2026-04-13 00:43:05.115638	\N	\N
147	54165148	system	🚀 إعلان مميز من Ahmed	✨ "شبكة سوق للإعلانات — بيع واشتري في ثوانٍ" — عرض مميز لا تفوّته!	/ads/68	f	2026-04-13 00:43:15.349376	\N	\N
148	b093fdc4-7bde-4f30-bf50-801b6b215217	system	🚀 إعلان مميز من Ahmed	✨ "شبكة سوق للإعلانات — بيع واشتري في ثوانٍ" — عرض مميز لا تفوّته!	/ads/68	f	2026-04-13 00:43:15.356469	\N	\N
149	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من Ahmed	✨ "شبكة سوق للإعلانات — بيع واشتري في ثوانٍ" — عرض مميز لا تفوّته!	/ads/68	f	2026-04-13 00:43:15.361674	\N	\N
150	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من Ahmed	✨ "شبكة سوق للإعلانات — بيع واشتري في ثوانٍ" — عرض مميز لا تفوّته!	/ads/68	f	2026-04-13 00:43:15.364971	\N	\N
151	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"مديق هروميز: شريان العالم" — شاهد الإعلان الآن	/ads/77	f	2026-04-13 01:38:10.909987	\N	\N
152	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"انشر إعلانك في ثواني وخلي الذكاء الاصطناعي يجيب لك عملاء" — شاهد الإعلان الآن	/ads/78	f	2026-04-13 01:45:57.580486	\N	\N
153	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"اشبع شهيتك واجعل البيع والشراء أسهل!" — شاهد الإعلان الآن	/ads/79	f	2026-04-13 02:14:42.375109	\N	\N
154	54219806	system	✅ تم تأكيد دفعك	تم تأكيد دفعك بمبلغ 250.00 ج.م عبر InstaPay للإعلان: انشر إعلانك في ثواني وخلي الذكاء الاصطناعي يجيب لك عملاء	/ads/78	f	2026-04-13 02:18:27.437319	\N	\N
155	54165148	system	🚀 إعلان مميز من Ahmed	✨ "انشر إعلانك في ثواني وخلي الذكاء الاصطناعي يجيب لك عملاء" — عرض مميز لا تفوّته!	/ads/78	f	2026-04-13 02:23:00.120739	\N	\N
156	b093fdc4-7bde-4f30-bf50-801b6b215217	system	🚀 إعلان مميز من Ahmed	✨ "انشر إعلانك في ثواني وخلي الذكاء الاصطناعي يجيب لك عملاء" — عرض مميز لا تفوّته!	/ads/78	f	2026-04-13 02:23:00.127243	\N	\N
157	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من Ahmed	✨ "انشر إعلانك في ثواني وخلي الذكاء الاصطناعي يجيب لك عملاء" — عرض مميز لا تفوّته!	/ads/78	f	2026-04-13 02:23:00.132404	\N	\N
158	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من Ahmed	✨ "انشر إعلانك في ثواني وخلي الذكاء الاصطناعي يجيب لك عملاء" — عرض مميز لا تفوّته!	/ads/78	f	2026-04-13 02:23:00.135198	\N	\N
159	54165148	comment	رسالة جديدة 📩	أحمد : منتج رائع 	/messages	f	2026-04-13 16:06:34.306238	\N	f1bea370-0eff-4578-9bc0-e9034e32d9fd
160	54219806	like	إعجاب جديد ❤️	أحمد  أعجب بمحتواك	/reels	f	2026-04-13 16:32:43.922788	\N	\N
161	54219806	like	إعجاب جديد ❤️	أحمد  أعجب بمحتواك	/reels	f	2026-04-13 16:32:48.936922	\N	\N
162	54219806	like	إعجاب جديد ❤️	أحمد  أعجب بمحتواك	/reels	f	2026-04-13 16:32:50.172006	\N	\N
163	54219806	like	إعجاب جديد ❤️	أحمد  أعجب بمحتواك	/ads/68	f	2026-04-13 17:32:26.833166	\N	\N
164	54219806	like	إعجاب جديد ❤️	أحمد  أعجب بمحتواك	/ads/47	f	2026-04-13 17:32:57.187945	\N	\N
165	54219806	comment	تعليق جديد 💬	أحمد : ممتاز	/ads/47	f	2026-04-13 17:33:09.759337	\N	\N
166	54219806	system	🚀 إعلان مميز من أحمد 	✨ "اكتسب المعرفة" — عرض مميز لا تفوّته!	/ads/80	f	2026-04-13 17:44:55.921994	\N	\N
167	54165148	system	🚀 إعلان مميز من أحمد 	✨ "اكتسب المعرفة" — عرض مميز لا تفوّته!	/ads/80	f	2026-04-13 17:44:55.932746	\N	\N
168	b093fdc4-7bde-4f30-bf50-801b6b215217	system	🚀 إعلان مميز من أحمد 	✨ "اكتسب المعرفة" — عرض مميز لا تفوّته!	/ads/80	f	2026-04-13 17:44:55.940773	\N	\N
169	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من أحمد 	✨ "اكتسب المعرفة" — عرض مميز لا تفوّته!	/ads/80	f	2026-04-13 17:44:55.944028	\N	\N
170	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من أحمد 	✨ "اكتسب المعرفة" — عرض مميز لا تفوّته!	/ads/80	f	2026-04-13 17:44:55.947224	\N	\N
171	54219806	system	🚀 إعلان مميز من أحمد 	✨ "اكتسب المعرفة" — عرض مميز لا تفوّته!	/ads/80	f	2026-04-13 17:46:43.619592	\N	\N
172	54165148	system	🚀 إعلان مميز من أحمد 	✨ "اكتسب المعرفة" — عرض مميز لا تفوّته!	/ads/80	f	2026-04-13 17:46:43.636555	\N	\N
173	b093fdc4-7bde-4f30-bf50-801b6b215217	system	🚀 إعلان مميز من أحمد 	✨ "اكتسب المعرفة" — عرض مميز لا تفوّته!	/ads/80	f	2026-04-13 17:46:43.648238	\N	\N
174	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من أحمد 	✨ "اكتسب المعرفة" — عرض مميز لا تفوّته!	/ads/80	f	2026-04-13 17:46:43.652036	\N	\N
175	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من أحمد 	✨ "اكتسب المعرفة" — عرض مميز لا تفوّته!	/ads/80	f	2026-04-13 17:46:43.655685	\N	\N
176	54219806	system	🚀 إعلان مميز من أحمد 	✨ "اكتسب المعرفة" — عرض مميز لا تفوّته!	/ads/80	f	2026-04-13 17:48:39.634261	\N	\N
177	54165148	system	🚀 إعلان مميز من أحمد 	✨ "اكتسب المعرفة" — عرض مميز لا تفوّته!	/ads/80	f	2026-04-13 17:48:39.642242	\N	\N
178	b093fdc4-7bde-4f30-bf50-801b6b215217	system	🚀 إعلان مميز من أحمد 	✨ "اكتسب المعرفة" — عرض مميز لا تفوّته!	/ads/80	f	2026-04-13 17:48:39.650449	\N	\N
179	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🚀 إعلان مميز من أحمد 	✨ "اكتسب المعرفة" — عرض مميز لا تفوّته!	/ads/80	f	2026-04-13 17:48:39.654432	\N	\N
180	541ad010-4694-4b7b-8574-63c29da5320c	system	🚀 إعلان مميز من أحمد 	✨ "اكتسب المعرفة" — عرض مميز لا تفوّته!	/ads/80	f	2026-04-13 17:48:39.661154	\N	\N
181	54219806	payment	💰 طلب شحن محفظة جديد	Ahmed Mohamed — 100 ج.م عبر instapay	/admin	f	2026-04-13 22:52:26.754015	\N	\N
182	54165148	payment	💰 طلب شحن محفظة جديد	Ahmed Mohamed — 100 ج.م عبر instapay	/admin	f	2026-04-13 22:52:26.769523	\N	\N
183	54219806	payment	✅ تمت الموافقة على شحن محفظتك	تم إضافة 100 ج.م إلى رصيدك بنجاح 💰	/wallet	f	2026-04-13 22:54:05.232681	\N	\N
184	54219806	payment	💳 طلب دفع جديد	ahmed mohmed — 610 ج.م عبر اتصالات e& كاش — renewal_30,renewal,ai_image,ai_video,ai_credits,ai_content	/admin	f	2026-04-13 23:30:03.723514	\N	\N
185	54165148	payment	💳 طلب دفع جديد	ahmed mohmed — 610 ج.م عبر اتصالات e& كاش — renewal_30,renewal,ai_image,ai_video,ai_credits,ai_content	/admin	f	2026-04-13 23:30:03.740146	\N	\N
186	54165148	payment	✅ تم تفعيل خدمتك!	تم تفعيل خدمة "ai_content" — رقم الطلب: ORD-20260413-4939	/payments	f	2026-04-13 23:30:41.682776	\N	\N
187	54165148	payment	✅ تم قبول طلب الدفع وتفعيل الخدمة	رقم الطلب ORD-20260413-4939 — تمت الموافقة وتفعيل الخدمة تلقائياً	/payments	f	2026-04-13 23:30:41.691118	\N	\N
188	54165148	payment	✅ تم تفعيل خدمتك!	تم تفعيل خدمة "renewal_30" — رقم الطلب: ORD-20260413-1963	/payments	f	2026-04-13 23:30:49.902379	\N	\N
189	54165148	payment	✅ تم قبول طلب الدفع وتفعيل الخدمة	رقم الطلب ORD-20260413-1963 — تمت الموافقة وتفعيل الخدمة تلقائياً	/payments	f	2026-04-13 23:30:49.910533	\N	\N
219	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"حقق مبيعاتك بتقنية الذكاء الصناعي الآن!" — شاهد الإعلان الآن	/ads/81	f	2026-04-14 00:29:20.870221	\N	\N
220	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد " — شاهد الآن	/streams/44	f	2026-04-15 22:02:01.983469	\N	\N
221	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد " — شاهد الآن	/streams/44	f	2026-04-15 22:36:46.065797	\N	\N
222	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد " — شاهد الآن	/streams/45	f	2026-04-15 23:07:15.076534	\N	\N
223	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد عصمت " — شاهد الآن	/streams/46	f	2026-04-15 23:12:42.260398	\N	\N
224	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"احمد عصمت " — شاهد الآن	/streams/46	f	2026-04-15 23:12:53.529827	\N	\N
225	54219806	system	🪙 طلب شحن عملات جديد	محمد محمدود — 100 عملة مقابل 10 ج.م (إنستاباي)	/admin	f	2026-04-15 23:15:45.765975	\N	\N
226	54165148	system	🪙 طلب شحن عملات جديد	محمد محمدود — 100 عملة مقابل 10 ج.م (إنستاباي)	/admin	f	2026-04-15 23:15:45.776163	\N	\N
227	db4019e3-eb97-4d90-aac2-4bbe570905b1	payment	✅ تم قبول طلب شحن العملات	تمت إضافة 100 عملة إلى محفظتك بنجاح 🎉	/coins	f	2026-04-15 23:16:34.098686	\N	\N
228	54219806	system	🪙 طلب شحن عملات جديد	محمد محمدود — 575 عملة مقابل 40 ج.م (إنستاباي)	/admin	f	2026-04-15 23:17:23.060369	\N	\N
229	54165148	system	🪙 طلب شحن عملات جديد	محمد محمدود — 575 عملة مقابل 40 ج.م (إنستاباي)	/admin	f	2026-04-15 23:17:23.069871	\N	\N
230	db4019e3-eb97-4d90-aac2-4bbe570905b1	payment	✅ تم قبول طلب شحن العملات	تمت إضافة 575 عملة إلى محفظتك بنجاح 🎉	/coins	t	2026-04-15 23:17:55.625509	\N	\N
231	54219806	payment	💰 طلب شحن محفظة جديد	محمد محمدود — 500 ج.م عبر vodafone	/admin	f	2026-04-15 23:19:34.081406	\N	\N
232	54165148	payment	💰 طلب شحن محفظة جديد	محمد محمدود — 500 ج.م عبر vodafone	/admin	f	2026-04-15 23:19:34.090241	\N	\N
235	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"أحمد " — شاهد الآن	/streams/47	f	2026-04-16 03:50:31.072107	\N	\N
236	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"أحمد " — شاهد الآن	/streams/47	f	2026-04-16 03:52:27.926806	\N	\N
237	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"أحمد " — شاهد الآن	/streams/47	f	2026-04-16 03:56:24.511642	\N	\N
238	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"أحمد " — شاهد الآن	/streams/47	t	2026-04-16 04:48:02.147091	\N	\N
234	54219806	system	📡 ahmed بدأ بثاً مباشراً!	"أحمد " — شاهد الآن	/streams/47	t	2026-04-16 03:49:57.550376	\N	\N
233	db4019e3-eb97-4d90-aac2-4bbe570905b1	payment	✅ تمت الموافقة على شحن محفظتك	تم إضافة 500 ج.م إلى رصيدك بنجاح 💰	/wallet	t	2026-04-15 23:20:03.282282	\N	\N
239	56d29356-b8a4-4572-a90d-5e9f99e7713f	system	🆕 إعلان جديد من Ahmed	"انشر إعلانك في ثواني وخلي الذكاء الاصطناعي يجيب لك عملاء" — شاهد الإعلان الآن	/ads/82	f	2026-04-18 14:19:04.512573	\N	\N
240	54219806	payment	💳 طلب دفع جديد	Ahmed Mohamed — 99 ج.م عبر فودافون كاش	/admin	f	2026-04-18 14:37:34.444198	\N	\N
241	54165148	payment	💳 طلب دفع جديد	Ahmed Mohamed — 99 ج.م عبر فودافون كاش	/admin	f	2026-04-18 14:37:34.463355	\N	\N
242	54219806	payment	✅ تم قبول طلب الدفع وتفعيل الخدمة	رقم الطلب ORD-20260418-2610 — تمت الموافقة وتفعيل الخدمة تلقائياً	/payments	f	2026-04-18 14:37:57.005201	\N	\N
243	54219806	payment	📋 استشارة جديدة من Ahmed Mohamed: ممكن ارف اعمل اعلان ممول ازى 	طلب استشارة: ممكن ارف اعمل اعلان ممول ازى 	/consultations	f	2026-04-18 14:40:23.423493	\N	\N
244	54219806	like	إعجاب جديد ❤️	ahmed أعجب بمحتواك	/ads/82	f	2026-04-18 14:46:20.702633	\N	\N
245	54219806	like	إعجاب جديد ❤️	ahmed أعجب بمحتواك	/ads/82	f	2026-04-18 14:46:37.435027	\N	\N
\.


--
-- Data for Name: offers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.offers (id, from_user_id, from_user_name, ad_id, offer_amount_egp, message, status, created_at) FROM stdin;
\.


--
-- Data for Name: payment_notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_notifications (id, ad_id, payer_name, payer_phone, paid_amount, payment_method, status, created_at, screenshot_url, payer_user_id) FROM stdin;
1	75	احمد محمد 	01285558567	200.00	InstaPay	confirmed	2026-04-12 22:16:05.918345	/uploads/516b1e51-d06e-48ef-ba73-df3ab34ba194.png	54219806
2	78	احمد  محمد	01285558567	250.00	InstaPay	confirmed	2026-04-13 02:17:54.050044	/uploads/e0576d01-8381-42d7-ab66-a0f0a09f1ac4.png	54219806
\.


--
-- Data for Name: payment_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_requests (id, user_id, type, amount_egp, method, phone_number, status, admin_note, created_at, order_number, ad_id, screenshot_url, service_type, payment_ref, national_id, card_number) FROM stdin;
1	54219806	top_up	50	etisalat	01285558567	approved	\N	2026-03-28 07:42:02.388041	ORD-20260328-5630	11	\N	\N	\N	\N	\N
2	54165148	withdrawal	100	souq	\N	approved	\N	2026-03-28 16:18:29.152225	ORD-20260328-8812	45	\N	\N	\N	\N	\N
3	54219806	top_up	155	vodafone	01126665741	approved	\N	2026-03-31 22:47:43.875055	ORD-20260331-4273	17	\N	\N	\N	\N	\N
4	54219806	top_up	155	souq	\N	approved	\N	2026-03-31 22:50:19.531209	ORD-20260331-6187	17	\N	\N	\N	\N	\N
5	54219806	top_up	365	vodafone	01126665741	approved	\N	2026-04-01 03:29:15.374991	ORD-20260401-5107	25	/uploads/9ff1acb2-b94a-4be7-9e24-272fc5bc9280.png	ai_credits,ai_video,renewal,ad_boost,campaign,ai_image,ai_content,other	\N	\N	\N
6	54165148	top_up	450	vodafone	\N	approved	\N	2026-04-02 12:14:02.883033	ORD-20260402-8846	\N	/uploads/658e0a92-e4de-48f8-a909-5c9580f7df62.jpg	\N	\N	\N	\N
7	54165148	top_up	765	vodafone	01285558567	approved	\N	2026-04-08 02:20:40.257188	ORD-20260408-3479	\N	/uploads/dd0b71b7-0049-4411-873f-3286cd50c8b1.jpg	renewal_30,ad_boost,campaign,ai_video,ai_image,ai_content,ai_credits	\N	\N	\N
8	54219806	top_up	765	instapay	0128558567	approved	\N	2026-04-12 22:18:25.098021	ORD-20260412-6305	\N	/uploads/eec38c09-3dcb-4334-9874-323f904b3bac.png	campaign,renewal_30,renewal,ad_boost,ai_image,ai_video,ai_content	1250	\N	\N
9	54219806	top_up	915	vodafone	012855685	approved	\N	2026-04-12 22:23:31.502165	ORD-20260412-1509	12	/uploads/24dec932-d2cf-4578-ba02-08d8056b084c.png	ai_video,ai_credits,talking_photo,other,ai_content,ai_image,renewal,renewal_30,campaign,ad_boost	125	\N	\N
10	54165148	top_up	1060	etisalat	\N	approved	\N	2026-04-13 22:55:56.042332	ORD-20260413-4939	-4	/uploads/d4455653-5959-45e9-895c-1e4a98817335.png	ai_content,ai_image,renewal,ad_boost,campaign,ai_video,renewal_30,ai_credits,talking_photo	250	\N	\N
11	54165148	top_up	610	etisalat	01285558567	approved	\N	2026-04-13 23:30:03.718103	ORD-20260413-1963	\N	/uploads/1baa5a52-a7f5-4603-8420-8206f1edc130.png	renewal_30,renewal,ai_image,ai_video,ai_credits,ai_content	250	\N	\N
12	54219806	withdrawal	99	vodafone	01285558566	approved	\N	2026-04-18 14:37:34.438965	ORD-20260418-2610	5	/uploads/262a7639-bbcb-415c-a39d-b2e8aaea23b5.png	\N	احمد محمد || vodafone || 01285558566	\N	\N
\.


--
-- Data for Name: platform_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.platform_settings (id, key, value, updated_at) FROM stdin;
1812	renewal_price_7	50	2026-04-08 00:24:12.040129
402	coupon_price_egp	49.99	2026-04-13 02:20:36.984
3	cpm_rate_egp	60	2026-03-31 22:42:50.612
10	vapid_public_key	BNw7lnGBnFIzfUegiRPGxbaad0PmfKXNgJRsahV3WkfbjRNU4m3mT4bbzet0x6sgckXTxOzJiG_sBHad-mScZKM	2026-03-29 18:49:38.777232
11	vapid_private_key	Tn8fKetqnETK75cwuK7Pv8k6dXYcaX6O-RK1ORAIFgg	2026-03-29 18:49:38.780392
9	admin_pin	1d43d7ced75e830568e02b0775d6a0a51cb50ccec9dd1a45d02a7e58bbd20e3b	2026-03-29 11:03:16.992314
2324	boost_share_reward_egp	5	2026-04-08 22:55:18.52154
88	boost_enabled	1	2026-04-12 22:20:34.268
13	ai_price_image	30	2026-03-31 16:05:53.082391
14	ai_price_video	100	2026-03-31 16:05:53.082391
4	publisher_rev_share	40	2026-03-31 22:42:50.608
15	ai_price_animation	80	2026-03-31 16:05:53.082391
16	ai_price_content	30	2026-03-31 16:05:53.082391
607	platform_name	شبكة سوق للإعلانات	2026-04-03 23:44:08.931137
608	platform_tagline	أفضل منصة إعلانية في مصر والعالم العربي	2026-04-03 23:44:08.934304
609	app_play_store	https://play.google.com/store/apps/details?id=com.apmo.souqmarket	2026-04-03 23:44:08.936998
610	app_app_store	https://apps.apple.com/eg/app/as-souqmarket/id6740153334	2026-04-03 23:44:08.939608
611	app_huawei	https://app.as-souqmarkat.com/?from-splash=false	2026-04-03 23:44:08.942514
613	contact_instapay	01285558567	2026-04-03 23:44:08.948738
633	feature_ads	1	2026-04-03 23:47:10.755603
635	feature_channels	1	2026-04-03 23:47:10.761703
636	feature_livestream	1	2026-04-03 23:47:10.764582
637	feature_messages	1	2026-04-03 23:47:10.767709
638	feature_campaigns	1	2026-04-03 23:47:10.770244
639	feature_ai	1	2026-04-03 23:47:10.773246
640	feature_registration	1	2026-04-03 23:47:10.77601
641	feature_boost	1	2026-04-03 23:47:10.779855
727	promo_banner_url	https://play.google.com/store/apps/details?id=com.apmo.souqmarket	2026-04-04 01:21:27.115674
697	promo_banner_text	🎉 قسّط على 6شهر بدون فوائد | حمّل تطبيق سوق ماركات الآن | عروض حصرية لفترة محدودة | ads-as.com	2026-04-04 03:11:03.475
17	ai_price_post	10	2026-03-31 16:05:53.082391
18	ai_referral_bonus_egp	5	2026-03-31 16:05:53.082391
1	ai_free_credits	4	2026-04-13 22:37:00.278
2	ai_price_per_credit_egp	50	2026-04-13 22:37:00.282
758	last_published_at	2026-04-17T22:05:28.709Z	2026-04-04 01:24:31.408574
634	feature_reels	1	2026-04-12 02:17:13.804
696	promo_banner_enabled	1	2026-04-04 19:11:02.694
5	min_withdrawal_egp	100	2026-04-13 22:37:00.261
3322	boost_duration_days	30	2026-04-13 21:11:59.857482
3440	ai_price_talking_photo	100	2026-04-13 21:57:05.975663
1662	contact_bank_name	البنك الأهلي المصري	2026-04-07 22:28:45.916996
1663	contact_bank_account	1234567890123456	2026-04-07 22:28:45.934993
1664	contact_bank_iban		2026-04-07 22:28:45.938361
1665	contact_bank_account_name	سوق ماركات	2026-04-07 22:28:45.942223
614	contact_whatsapp	01126665741	2026-04-04 05:15:07.761
612	contact_vodafone_cash	01098553911	2026-04-03 23:44:08.945502
25	renewal_price_30	350	2026-03-31 16:22:11.696869
93	boost_price_egp	250	2026-03-31 22:42:50.605187
26	renewal_price_60	650	2026-03-31 16:22:11.696869
27	renewal_price_90	900	2026-03-31 16:22:11.696869
\.


--
-- Data for Name: push_subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) FROM stdin;
981	db4019e3-eb97-4d90-aac2-4bbe570905b1	https://fcm.googleapis.com/fcm/send/e7iTrZmBI3A:APA91bFFTK7UT4g94gsjHriJJqLr8gfMgXp4tXbc7Tk7y-kwdMNtqc6lU0rQHTgJnh_XmODQ0swlicTAuBmxT_uY7TDf96aG8XiCLzqY_K859nnXMRyO3mKt2x10Dy3lIDi21l32TfNj	BJsfnBDZsSH1WCemsc19JtiPjfTTQjD4uNOPfDcdqg6OVDBQwXqOEUYrodsySXBpudag4n1CVS0cb11FSI5v5jY	DWJ0XrcUvCV9v8OA0b397A	2026-04-15 22:42:10.809797
826	54219806	https://fcm.googleapis.com/fcm/send/dXMG2j_Ksvg:APA91bFLHBqj5aH-A8PHUpXFW5hKSREX3PV1G-TWl44Fr6rYFzdRduq3ru0mGLTYlS9CrK3JECaCgsfJPW0j0TRN2u5NxiJevjRNBPeYZe9eNO1uTCyrjxEZaoOL0l6zECK5ETsfpKHb	BCPJF8mAZEn6goTf0f41Rpg517dMryBYV6GSTPxJnrgWn41RAljjIcaOzjnrakU2E6O7W25Iv8w30GtvfwkmKe4	osAMWNf3GnELgui-ng2A_w	2026-04-11 21:53:51.475453
875	54165148	https://fcm.googleapis.com/wp/cOeCBI1oK7o:APA91bFq3K-qYZTy6HV85aJS6SRgcx6uWB9yiOovLTCepg5DSVTpDb0EbHed32iop41nxxV1-OPqDABGanYauuUAyyROJdGhKfdErEuAi2b6ItiDJenuQtYM814fniI7vtU-o0ij_NFT	BDf8tdngH3O7YQkDAteofP-o9KZzWGMM1SzH-HtiIr56x8HClPCx8GI_t_0Uv5ri1xe6CIq8l3HlfV5-Uxxpx24	8rS3W5wes_2lnQImkjqHlA	2026-04-13 15:56:11.30835
814	54219806	https://fcm.googleapis.com/fcm/send/esOqRTuvqlQ:APA91bGXWg4Ju4bcsCLBjqPQ5zqVExt-iVzPMA31zsz8kIPsqRZ86sKHQ-YjDOOeGGExUo276OGAyi5czwdUOtuwrHwPi7ZF-mlt09wUO1-rdUBNyHJg1lj83qmGYMq8UEo-d2I6tWCi	BImyrHgrhTPIph31kzrdBoEjYIxtkUHsZOi0QGIjh4m2-IgdF44L5j6KczABgXA9L2bDy3-__CVV9u2LdYaCuFw	ml8lyxE-PNUsppmlvPmQQA	2026-04-11 17:55:03.566325
986	54165148	https://fcm.googleapis.com/fcm/send/ekLersS3HDU:APA91bEh-HEvDgXNwWXGOZ_3LvZ_m-MXMzUL4U2_jeS_ItlbJFmsO7uET4rCsyemS9pSqTxta8OCo2_NOsJ_Wm1TOsHOOQPQ4LWRautapLatSAY_V5_5PZ66CtcMhza91cdK7ad1Rtvz	BBewte3AE0y7RlKbGEgyxNSnX3tVCZ2PWVze9dXbFvg2MRVjbxUzUiYDfm_iMfRuR_au2Txg-GxgaBTomUbTgz4	Imv8ild9k06qXaQcYm090w	2026-04-15 22:54:01.06193
603	54165148	https://fcm.googleapis.com/fcm/send/cOeCBI1oK7o:APA91bFq3K-qYZTy6HV85aJS6SRgcx6uWB9yiOovLTCepg5DSVTpDb0EbHed32iop41nxxV1-OPqDABGanYauuUAyyROJdGhKfdErEuAi2b6ItiDJenuQtYM814fniI7vtU-o0ij_NFT	BK_L2QHtEq7fWWriu_moOjvdU0RIG0sZCWbyB4DniKN7neA3C6fG_GuxhdRRfuUep_1WN7xmQhgObQ5O4Mkjq_s	IT78rctzybhE7lCz8O3d0w	2026-04-07 18:10:12.036056
976	54219806	https://fcm.googleapis.com/wp/dXMG2j_Ksvg:APA91bFLHBqj5aH-A8PHUpXFW5hKSREX3PV1G-TWl44Fr6rYFzdRduq3ru0mGLTYlS9CrK3JECaCgsfJPW0j0TRN2u5NxiJevjRNBPeYZe9eNO1uTCyrjxEZaoOL0l6zECK5ETsfpKHb	BF8mLAuu7ope5RCNOrGPyg7hV-4j3XSoUeCHjHGhaejMcWIOFvM99qJ6oMR_ImdMAQYI-s19gEs-_aOODHfRhZ8	i647XaKKc-91uSR9M8gigQ	2026-04-15 21:57:55.164007
876	f1bea370-0eff-4578-9bc0-e9034e32d9fd	https://fcm.googleapis.com/fcm/send/fyQwCqJV4O4:APA91bGKSxdFXL3oRnKKuO5d3J7g6i1MJbChfAwxdQ9F2Z0cbR10kuC0ngTLVFWyvNcww-zpSprFdLByZZj9zeoERYWRNjfxIZ_SNX7dtakKPSVxGct_KtJRey73R5gYnrA049gpgpXX	BAZKUXtyRitGSX5skOJGTge6WZBdbk6z07Z-00jWJLQeuKLEVUqwjjGdLlGPqF2nYlgYd2SEn5O-1UXHfZDjdMA	qH5r2BJGncLBX-EbuinMHw	2026-04-13 16:04:05.738024
874	54219806	https://fcm.googleapis.com/wp/esOqRTuvqlQ:APA91bGXWg4Ju4bcsCLBjqPQ5zqVExt-iVzPMA31zsz8kIPsqRZ86sKHQ-YjDOOeGGExUo276OGAyi5czwdUOtuwrHwPi7ZF-mlt09wUO1-rdUBNyHJg1lj83qmGYMq8UEo-d2I6tWCi	BARiXKbYO8ix23olhy4YuZzNopGsoUxrCjuwmv6t9Xx-vVLQYV7I_6Aqsg0JrCfuXIx3fzF5YRGjNk6JKg0Um9s	5L0DAbGTBWjcVmZGTWR-sA	2026-04-13 15:55:52.342356
\.


--
-- Data for Name: ratings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ratings (id, user_id, user_name, target_type, target_id, rating, review, created_at) FROM stdin;
1	54165148	ahmed mohmed	ad	9	5	ممتاز 	2026-03-28 00:08:42.322543
2	54165148	ahmed mohmed	ad	10	5	\N	2026-03-28 04:32:11.873287
17	54219806	Ahmed Mohamed	ad	9	5	\N	2026-03-28 15:31:17.162165
21	54219806	Ahmed Mohamed	ad	8	5	\N	2026-03-28 15:31:29.555316
22	54219806	Ahmed Mohamed	ad	7	5	\N	2026-03-28 15:31:31.689903
23	54219806	Ahmed Mohamed	ad	6	5	\N	2026-03-28 15:31:34.554706
3	54165148	ahmed mohmed	ad	11	4	\N	2026-03-28 04:38:32.573656
4	54165148	ahmed mohmed	ad	12	4	\N	2026-03-28 04:39:48.360451
11	54165148	ahmed mohmed	ad	45	4	\N	2026-03-28 05:15:35.381303
40	54165148	ahmed mohmed	ad	8	5	\N	2026-03-29 23:52:50.218938
41	54165148	ahmed mohmed	ad	7	5	\N	2026-03-29 23:52:52.907029
42	54165148	ahmed mohmed	ad	6	5	\N	2026-03-29 23:52:55.928191
43	54219806	Ahmed Mohamed	ad	46	5	\N	2026-03-30 00:01:31.309014
15	54219806	Ahmed Mohamed	ad	11	5	\N	2026-03-28 14:29:38.965713
20	54219806	Ahmed Mohamed	ad	12	5	\N	2026-03-28 15:31:25.401922
18	54219806	Ahmed Mohamed	ad	10	5	\N	2026-03-28 15:31:18.786099
48	54219806	Ahmed Mohamed	ad	2	5	\N	2026-03-30 19:41:42.167454
49	54219806	Ahmed Mohamed	ad	1	5	\N	2026-03-30 19:41:43.671493
50	54219806	Ahmed Mohamed	ad	3	5	\N	2026-03-30 19:41:45.91099
51	54219806	Ahmed Mohamed	ad	47	5	\N	2026-03-31 22:40:24.810804
16	54219806	Ahmed Mohamed	ad	45	5	\N	2026-03-28 14:54:39.777901
56	54219806	Ahmed Mohamed	ad	48	5	\N	2026-04-03 00:57:47.69209
57	54219806	Ahmed Mohamed	ad	57	5	\N	2026-04-04 01:26:56.392286
58	54219806	Ahmed Mohamed	ad	62	5	\N	2026-04-08 01:21:27.090196
59	54219806	Ahmed Mohamed	user	54165148	5	ممتاز	2026-04-09 20:19:25.952121
60	54165148	ahmed mohmed	user	54219806	5	ممتاز	2026-04-09 22:52:10.960094
61	54219806	Ahmed Mohamed	ad	66	5	\N	2026-04-10 02:31:56.396363
62	54219806	Ahmed Mohamed	ad	67	5	\N	2026-04-12 00:14:35.572196
63	54219806	Ahmed Mohamed	ad	75	5	\N	2026-04-13 00:41:13.400706
64	f1bea370-0eff-4578-9bc0-e9034e32d9fd	أحمد  حسين	ad	61	5	رائع 	2026-04-13 16:06:19.986826
65	f1bea370-0eff-4578-9bc0-e9034e32d9fd	أحمد  حسين	ad	69	5	ممتاز	2026-04-13 16:30:07.100089
66	f1bea370-0eff-4578-9bc0-e9034e32d9fd	أحمد  حسين	ad	68	5	\N	2026-04-13 17:32:27.258021
67	54219806	Ahmed Mohamed	ad	76	5	\N	2026-04-16 14:22:59.615547
68	54165148	ahmed mohmed	ad	82	5	\N	2026-04-18 14:46:49.869748
\.


--
-- Data for Name: reels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reels (id, user_id, channel_id, title, description, video_url, thumbnail_url, duration, views_count, likes_count, comments_count, status, created_at, is_voice_comment, audio_url) FROM stdin;
4	54219806	1	الشيخ محمد صديق المنشاوى	أجمل ما تبدأ به يومك لصاحب الحنجرة الذهبية الشيخ محمد صديق المنشاوي	https://www.youtube.com/watch?v=Ect7R47t5XA	\N	30	0	1	0	active	2026-04-04 04:02:21.577251	f	\N
6	54219806	1	عروض وخصومات  من تطبيق سوق ماركات 	عروض وخصومات  من تطبيق سوق ماركات 	/uploads/286e1817-5558-431c-b383-cc287e80d025.mp4	\N	30	0	0	0	active	2026-04-18 14:30:34.249427	f	/uploads/tts-1776522628369.mp3
2	54165148	2	منتجات بجودة عالية 	اشتري الان من تطبيق  سوق ماركات وحصل علي خصم ١٠٠ جنية علي اول طلب الان	/uploads/video-1774674191461.mp4	\N	30	0	0	0	active	2026-03-28 05:04:59.163425	f	/uploads/tts-1774674287292.mp3
1	54219806	1	منتجات جيهينة	عصير طبعى من جهينة يخطف العين	/uploads/video-1774558461330.mp4	\N	30	5	1	1	active	2026-03-26 20:57:40.531841	f	/uploads/tts-1774558465639.mp3
3	54219806	1	عروض وخصومات من تطبيق سوق ماركات  	تسوق الان من تطبيق سوق ماركات  وحصل على خصم  100 جنية على اول طلب الان	/uploads/video-1775174447190.mp4	\N	30	0	0	0	active	2026-04-03 00:02:55.765897	f	/uploads/tts-1775174561963.mp3
5	54165148	2	شهد الان 	وشوف الخبر	https://www.youtube.com/watch?v=XLMzZwZd7Bs	\N	30	0	0	0	active	2026-04-07 19:05:12.775011	f	\N
\.


--
-- Data for Name: referrals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.referrals (id, referrer_id, referred_id, bonus_egp, status, created_at) FROM stdin;
1	54219806	54165148	5.00	confirmed	2026-04-15 22:01:36.493967
2	54165148	db4019e3-eb97-4d90-aac2-4bbe570905b1	5.00	confirmed	2026-04-16 00:08:32.69792
\.


--
-- Data for Name: renewal_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.renewal_orders (id, order_number, ad_id, user_id, duration_days, amount, status, created_at) FROM stdin;
1	RNW-1775587474366-45	45	54165148	30	50.00	confirmed	2026-04-07 18:44:34.366985
2	RNW-1775691955871-47	47	54219806	30	350.00	confirmed	2026-04-08 23:45:55.871275
3	RNW-1775691987952-62	62	54219806	30	350.00	confirmed	2026-04-08 23:46:27.952959
\.


--
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reports (id, reporter_id, target_type, target_id, reason, status, admin_note, created_at) FROM stdin;
4	54219806	ad	3	محتوى مخالف للسياسة	resolved	\N	2026-03-26 17:39:13.205943
3	54219806	ad	3	محتوى مخالف للسياسة	resolved	\N	2026-03-26 17:39:12.249761
2	54219806	ad	3	محتوى مخالف للسياسة	resolved	\N	2026-03-26 00:57:16.702128
1	54219806	ad	3	محتوى مخالف للسياسة	resolved	\N	2026-03-26 00:57:04.094903
\.


--
-- Data for Name: revenue_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.revenue_transactions (id, user_id, type, amount, description, campaign_id, channel_id, created_at, amount_egp) FROM stdin;
23	54219806	earning	0.0462	إيراد إعلان - حملة #2	2	1	2026-03-29 18:33:39.219952	0.0462
24	54219806	spending	0.077	تكلفة مشاهدة - حملة تطبيق سوق ماركات 	2	\N	2026-03-29 18:33:39.223089	0.077
25	54219806	spending	0.015	تكلفة مشاهدة - حملة تطبيق سوق ماركات 	1	\N	2026-03-29 20:54:55.824479	0.015
26	54219806	spending	0.75	تكلفة نقرة - حملة تطبيق سوق ماركات 	1	\N	2026-03-29 20:55:05.036329	0.75
27	54219806	spending	0.015	تكلفة مشاهدة - حملة تطبيق سوق ماركات 	1	\N	2026-03-29 20:55:15.807413	0.015
28	54219806	spending	0.75	تكلفة نقرة - حملة تطبيق سوق ماركات 	1	\N	2026-03-29 20:55:19.900721	0.75
29	54165148	earning	0.0462	إيراد إعلان - حملة #2	2	2	2026-03-29 21:09:49.590315	0.0462
30	54219806	spending	0.077	تكلفة مشاهدة - حملة تطبيق سوق ماركات 	2	\N	2026-03-29 21:09:49.593503	0.077
31	54165148	earning	2.31	إيراد نقرة - حملة #2	2	2	2026-03-29 21:09:54.223433	2.31
32	54219806	spending	3.85	تكلفة نقرة - حملة تطبيق سوق ماركات 	2	\N	2026-03-29 21:09:54.22674	3.85
33	54165148	earning	0.009	إيراد إعلان - حملة #1	1	2	2026-03-29 21:10:19.521906	0.009
34	54219806	spending	0.015	تكلفة مشاهدة - حملة تطبيق سوق ماركات 	1	\N	2026-03-29 21:10:19.525699	0.015
35	54219806	spending	0.077	تكلفة مشاهدة - حملة تطبيق سوق ماركات 	2	\N	2026-03-29 22:44:17.833345	0.077
36	54219806	earning	0.009	إيراد إعلان - حملة #1	1	1	2026-03-29 23:51:27.057925	0.009
37	54219806	spending	0.015	تكلفة مشاهدة - حملة تطبيق سوق ماركات 	1	\N	2026-03-29 23:51:27.061263	0.015
38	54165148	earning	0.009	إيراد إعلان - حملة #1	1	2	2026-03-31 16:36:43.880358	0.009
39	54219806	spending	0.015	تكلفة مشاهدة - حملة تطبيق سوق ماركات 	1	\N	2026-03-31 16:36:43.884611	0.015
40	54219806	spending	0.015	تكلفة مشاهدة - حملة تطبيق سوق ماركات 	1	\N	2026-03-31 16:37:01.4733	0.015
41	54219806	spending	0.015	تكلفة مشاهدة - حملة تطبيق سوق ماركات 	1	\N	2026-03-31 16:37:27.526869	0.015
42	54165148	earning	0.0462	إيراد إعلان - حملة #2	2	2	2026-03-31 16:37:33.77843	0.0462
43	54219806	spending	0.077	تكلفة مشاهدة - حملة تطبيق سوق ماركات 	2	\N	2026-03-31 16:37:33.782455	0.077
44	54165148	earning	0.0462	إيراد إعلان - حملة #2	2	2	2026-03-31 19:50:19.96333	0.0462
45	54219806	spending	0.077	تكلفة مشاهدة - حملة تطبيق سوق ماركات 	2	\N	2026-03-31 19:50:19.966903	0.077
46	54165148	earning	0.009	إيراد إعلان - حملة #1	1	2	2026-03-31 19:50:27.928813	0.009
47	54219806	spending	0.015	تكلفة مشاهدة - حملة تطبيق سوق ماركات 	1	\N	2026-03-31 19:50:27.933034	0.015
48	54219806	spending	0.015	تكلفة مشاهدة - حملة تطبيق سوق ماركات 	1	\N	2026-03-31 19:50:41.571548	0.015
49	54219806	spending	0.75	تكلفة نقرة - حملة تطبيق سوق ماركات 	1	\N	2026-03-31 19:50:49.34139	0.75
50	54219806	spending	0.75	تكلفة نقرة - حملة تطبيق سوق ماركات 	1	\N	2026-03-31 19:50:57.117793	0.75
51	54219806	spending	0.077	تكلفة مشاهدة - حملة تطبيق سوق ماركات 	2	\N	2026-03-31 19:51:02.546447	0.077
52	54219806	spending	0.077	تكلفة مشاهدة - حملة تطبيق سوق ماركات 	2	\N	2026-03-31 19:52:59.943268	0.077
53	54165148	earning	0.009	إيراد إعلان - حملة #1	1	2	2026-03-31 19:53:02.481347	0.009
54	54219806	spending	0.015	تكلفة مشاهدة - حملة تطبيق سوق ماركات 	1	\N	2026-03-31 19:53:02.485302	0.015
55	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	1	\N	2026-04-07 18:34:42.777092	0.06
56	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	2	\N	2026-04-07 18:34:57.761126	0.06
57	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	2	\N	2026-04-07 18:35:02.119848	0.06
58	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	1	\N	2026-04-07 18:35:17.160034	0.06
59	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	1	\N	2026-04-07 18:35:32.13546	0.06
60	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	2	\N	2026-04-07 18:35:47.179163	0.06
61	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	2	\N	2026-04-07 18:35:52.052924	0.06
62	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	1	\N	2026-04-07 18:36:11.635744	0.06
63	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	2	\N	2026-04-07 18:36:11.803934	0.06
64	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	1	\N	2026-04-07 18:36:18.940279	0.06
65	54219806	spending	0.75	تكلفة نقرة - حملة تطبيق سوق ماركات  (CPC=0.75 ج.م)	1	\N	2026-04-07 18:43:17.789028	0.75
66	54219806	spending	0.75	تكلفة نقرة - حملة تطبيق سوق ماركات  (CPC=0.75 ج.م)	1	\N	2026-04-07 18:43:20.834389	0.75
67	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	2	\N	2026-04-13 16:31:57.204691	0.06
68	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	2	\N	2026-04-13 16:31:57.67355	0.06
69	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	2	\N	2026-04-13 16:32:03.339934	0.06
70	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	2	\N	2026-04-13 16:32:16.005842	0.06
71	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	2	\N	2026-04-13 16:32:19.509471	0.06
72	54219806	spending	0.75	تكلفة نقرة - حملة تطبيق سوق ماركات  (CPC=0.75 ج.م)	2	\N	2026-04-13 16:32:22.654949	0.75
73	54219806	spending	0.75	تكلفة نقرة - حملة تطبيق سوق ماركات  (CPC=0.75 ج.م)	2	\N	2026-04-13 16:32:26.421046	0.75
74	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	1	\N	2026-04-13 16:33:18.212891	0.06
75	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	1	\N	2026-04-13 16:35:33.222523	0.06
76	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	1	\N	2026-04-16 00:09:30.470324	0.06
77	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	2	\N	2026-04-16 00:09:34.618148	0.06
78	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	1	\N	2026-04-16 00:10:09.855436	0.06
79	54219806	spending	0.75	تكلفة نقرة - حملة تطبيق سوق ماركات  (CPC=0.75 ج.م)	1	\N	2026-04-16 00:10:11.681449	0.75
80	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	1	\N	2026-04-16 00:10:27.31758	0.06
81	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	2	\N	2026-04-16 00:10:39.129463	0.06
82	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	2	\N	2026-04-16 00:10:40.477764	0.06
83	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	2	\N	2026-04-16 00:10:41.296452	0.06
84	54219806	spending	0.06	تكلفة مشاهدة - حملة تطبيق سوق ماركات  (CPM=60 ج.م)	1	\N	2026-04-16 00:10:41.708829	0.06
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (sid, sess, expire) FROM stdin;
xKW6n27U07AezzbKEnioaKXUWeE6ILgD	{"cookie": {"path": "/", "secure": false, "expires": "2026-04-22T22:41:33.499Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "customUser": {"id": "db4019e3-eb97-4d90-aac2-4bbe570905b1", "email": "sm2@as-souqmarkat.com", "phone": null, "lastName": "محمدود", "firstName": "محمد", "profileImageUrl": null}}	2026-04-25 11:46:58
Gtm99uSWvdYHpWJb2HfcGVt2M9lc42Kv	{"cookie": {"path": "/", "secure": true, "expires": "2026-04-14T17:38:47.717Z", "httpOnly": true, "originalMaxAge": 604800000}, "customUser": {"id": "54219806", "email": "souqmarkat66@gmail.com", "phone": null, "lastName": "Mohamed", "firstName": "Ahmed", "profileImageUrl": null}}	2026-04-21 17:10:19
1QI4JSc5NIPgd46OZnmuPsgWDimphmCb	{"cookie": {"path": "/", "secure": false, "expires": "2026-04-22T21:59:56.251Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "customUser": {"id": "54165148", "email": "ahmedesmat.5151@gmail.com", "phone": null, "lastName": "mohmed", "firstName": "ahmed", "profileImageUrl": "https://storage.googleapis.com/replit/images/1770139560441_da274ae17a3bab2cfadfbe3f713a611c.jpeg"}}	2026-04-26 09:41:42
XA17_g3b_74dVFBRuJu3__m29rE_9wBY	{"cookie": {"path": "/", "secure": true, "expires": "2026-04-12T21:08:09.487Z", "httpOnly": true, "originalMaxAge": 604800000}, "customUser": {"id": "54165148", "email": "ahmedesmat.5151@gmail.com", "phone": null, "lastName": "mohmed", "firstName": "ahmed", "profileImageUrl": "https://storage.googleapis.com/replit/images/1770139560441_da274ae17a3bab2cfadfbe3f713a611c.jpeg"}}	2026-04-19 21:04:04
lTAAsnGODzQlfz4efN2Zs7vm7sgzL5u4	{"cookie": {"path": "/", "secure": false, "expires": "2026-04-20T16:04:02.043Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "customUser": {"id": "f1bea370-0eff-4578-9bc0-e9034e32d9fd", "email": "01034386554", "phone": null, "lastName": "حسين ", "firstName": "أحمد ", "profileImageUrl": null}}	2026-04-20 18:36:40
mo4o9etrvMtQl0nKbmqfaXHVteCD8Nsv	{"cookie": {"path": "/", "secure": true, "expires": "2026-04-14T18:10:06.291Z", "httpOnly": true, "originalMaxAge": 604800000}, "customUser": {"id": "54165148", "email": "ahmedesmat.5151@gmail.com", "phone": null, "lastName": "mohmed", "firstName": "ahmed", "profileImageUrl": "https://storage.googleapis.com/replit/images/1770139560441_da274ae17a3bab2cfadfbe3f713a611c.jpeg"}}	2026-04-21 17:14:58
_0muouNBwkkkb_PmQ5QSxUGsOGeV5Nlb	{"cookie": {"path": "/", "secure": false, "expires": "2026-04-21T18:05:17.595Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "customUser": {"id": "54219806", "email": "souqmarkat66@gmail.com", "phone": null, "lastName": "Mohamed", "firstName": "Ahmed", "profileImageUrl": null}}	2026-04-26 09:59:38
\.


--
-- Data for Name: smart_menus; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.smart_menus (id, user_id, slug, restaurant_name, restaurant_slogan, theme, style, items, is_active, views_count, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: stories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stories (id, user_id, media_url, media_type, caption, views_count, expires_at, created_at) FROM stdin;
1	54219806	/uploads/702ff0c4-c0a2-4f39-a96d-10cee5652205.png	image	\N	1	2026-04-19 14:27:39.176	2026-04-18 14:27:39.176816
\.


--
-- Data for Name: story_views; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.story_views (id, story_id, viewer_id, created_at) FROM stdin;
1	1	54219806	2026-04-18 14:27:47.767624
\.


--
-- Data for Name: stream_moderation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stream_moderation (id, stream_id, status, ai_verdict, ai_reason, reviewed_at) FROM stdin;
1	13	approved	safe	The title and description do not contain any explicit, violent, or fraudulent content.	2026-04-05 20:45:20.602177
2	13	approved	safe	The title and description do not contain any explicit, violent, or fraudulent content.	2026-04-05 20:47:49.50001
3	14	approved	safe	محتوى آمن ولا يحتوي على أي انتهاكات للسياسة.	2026-04-05 20:48:37.068065
4	15	approved	safe	The title and description do not contain any explicit, violent, or fraudulent content.	2026-04-05 20:49:42.807271
5	16	approved	safe	The title and description do not contain any explicit content, violence, incitement, or fraud.	2026-04-05 21:08:50.202264
6	17	approved	safe	محتوى غير مخالف للسياسات، يتحدث عن بيع منتجات.	2026-04-05 21:14:27.347062
7	18	flagged	unsafe	وصف غير كافٍ لتحديد طبيعة المحتوى، ولكن كلمة 'بيع' قد تشير إلى نشاط تجاري غير مصرح به أو احتيال.	2026-04-05 21:21:49.089289
8	19	approved	safe	محتوى تسويقي عادي ولا يحتوي على أي انتهاكات للسياسات.	2026-04-05 21:28:28.997223
9	20	approved	safe	The title and description do not contain any explicit, violent, or fraudulent content.	2026-04-05 21:34:25.554536
10	20	approved	safe	The title and description do not contain any explicit, violent, or fraudulent content.	2026-04-05 21:34:57.950169
11	21	approved	safe	The title and description do not contain any explicit content, violence, incitement, or fraud.	2026-04-05 21:42:06.540333
12	25	flagged	unsafe	وصف غير كافٍ لتحديد طبيعة المحتوى، ولكن كلمة 'بيع' قد تشير إلى نشاط تجاري غير قانوني أو احتيالي.	2026-04-05 21:54:57.472066
13	30	approved	safe	محتوى غير مخالف للسياسات، لا يحتوي على أي عناصر إباحية، عنف، تحريض، أو احتيال.	2026-04-05 22:29:40.003916
14	31	flagged	unsafe	وصف غير كافٍ لتحديد طبيعة المحتوى، ولكن كلمة 'بيع' قد تشير إلى نشاط تجاري غير قانوني أو احتيالي.	2026-04-05 22:42:41.358067
15	31	flagged	unsafe	الوصف غير كافٍ لتحديد طبيعة المحتوى، ولكن كلمة 'بيع' قد تشير إلى نشاط تجاري غير قانوني أو احتيالي.	2026-04-05 22:43:51.534292
16	31	flagged	unsafe	وصف غير كافٍ لتحديد طبيعة المحتوى، ولكن كلمة 'بيع' قد تشير إلى نشاط تجاري غير قانوني أو احتيالي.	2026-04-05 22:44:25.237765
17	32	approved	safe	The title and description do not contain any explicit content, violence, incitement, or fraud.	2026-04-05 22:49:43.047334
18	33	approved	safe	No explicit content, violence, or harmful behavior detected.	2026-04-05 22:55:34.53937
19	34	approved	safe	The title and description do not contain any explicit content, violence, incitement, or fraud.	2026-04-05 23:44:03.524909
20	35	flagged	unsafe	وصف غير كافٍ لتحديد طبيعة المحتوى، ولكن كلمة 'بيع' قد تشير إلى نشاط تجاري غير قانوني أو احتيالي.	2026-04-05 23:47:55.844467
21	36	approved	safe	The title and description do not contain any explicit, violent, or harmful content.	2026-04-05 23:54:57.268819
22	36	approved	safe	The title and description do not contain any explicit, violent, or harmful content.	2026-04-05 23:55:24.026599
23	36	approved	safe	No explicit content, violence, incitement, or fraud detected.	2026-04-06 00:04:16.175336
24	36	approved	safe	The title and description do not contain any explicit, violent, or harmful content.	2026-04-06 00:10:53.370866
25	37	approved	safe	The title and description do not contain any explicit content, violence, incitement, or fraud.	2026-04-06 01:16:46.44014
26	44	approved	safe	The title and description do not contain any explicit, violent, or harmful content.	2026-04-15 22:02:02.80979
27	44	approved	safe	The title and description do not contain any explicit, violent, or harmful content.	2026-04-15 22:36:46.625668
28	45	approved	safe	The title and description do not contain any explicit content, violence, incitement, or fraud.	2026-04-15 23:07:15.931582
29	46	approved	safe	The title and description do not contain any explicit content, violence, incitement, or fraud.	2026-04-15 23:12:43.245158
30	46	approved	safe	The title and description do not contain any explicit content, violence, incitement, or fraud.	2026-04-15 23:12:54.811206
31	47	approved	safe	The title and description do not contain any explicit, violent, or harmful content.	2026-04-16 03:49:58.732781
32	47	approved	safe	The title and description do not contain any explicit, violent, or harmful content.	2026-04-16 03:50:32.082225
33	47	approved	safe	The title and description do not contain any explicit, violent, or harmful content.	2026-04-16 03:52:28.959874
34	47	approved	safe	The title and description do not contain any explicit content, violence, incitement, or fraud.	2026-04-16 03:56:25.505785
35	47	approved	safe	The title and description do not contain any explicit, violent, or harmful content.	2026-04-16 04:48:03.10124
\.


--
-- Data for Name: uploaded_files; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.uploaded_files (id, user_id, filename, original_name, mime_type, size, url, created_at) FROM stdin;
1	54165148	4e15424d-cbbb-4a42-85b1-4aa793fbaff7.jpg	1000726287.jpg	image/jpeg	185259	/uploads/4e15424d-cbbb-4a42-85b1-4aa793fbaff7.jpg	2026-03-26 00:45:07.213404
2	54219806	742eaa8c-c1e8-4fa9-840e-fb7e9c0f8d29.jpg	ÙÙØ¬Ø© Ø§Ø¨Ø¶.jpg	image/jpeg	29164	/uploads/742eaa8c-c1e8-4fa9-840e-fb7e9c0f8d29.jpg	2026-03-26 00:51:27.266753
3	54219806	9fccca63-5a16-4bf5-9f67-757e5a0f0377.jpg	ÙÙØ¬Ø© Ø§Ø¨Ø¶.jpg	image/jpeg	29164	/uploads/9fccca63-5a16-4bf5-9f67-757e5a0f0377.jpg	2026-03-26 01:00:01.025145
4	54219806	283c215b-45a5-457d-b77a-07a76a2fa527.jpg	ÙÙØ¬Ø© Ø§Ø¨Ø¶.jpg	image/jpeg	29164	/uploads/283c215b-45a5-457d-b77a-07a76a2fa527.jpg	2026-03-26 01:04:45.516807
5	54219806	b1b1dc46-371e-4175-a349-de762703bbca.mp4	Ø¹Ø±Ø¶ Ø§ÙØªØ·Ø¨ÙÙ.mp4	video/mp4	8454260	/uploads/b1b1dc46-371e-4175-a349-de762703bbca.mp4	2026-03-26 16:57:22.432401
6	54219806	98d652f5-3a38-4745-acd2-dcbd256d241f.jpg	93a88949-3a0a-4d73-9022-0401bc8e3401.jpg	image/jpeg	131430	/uploads/98d652f5-3a38-4745-acd2-dcbd256d241f.jpg	2026-03-26 17:02:16.32538
7	54219806	ebc83d33-8e1e-4de2-82d6-3f8171a8edb6.mp4	ØªØ³ÙÙ Ø³ÙÙ ÙÙØ±ÙØ­ ÙØ¹ Ø³ÙÙ ÙØ§Ø±ÙØ§Øª.mp4	video/mp4	24898037	/uploads/ebc83d33-8e1e-4de2-82d6-3f8171a8edb6.mp4	2026-03-26 17:24:42.422401
8	54219806	7dce1851-f3ad-40f5-851f-4a3b062356de.mp4	ØªØ³ÙÙ Ø³ÙÙ ÙÙØ±ÙØ­ ÙØ¹ Ø³ÙÙ ÙØ§Ø±ÙØ§Øª.mp4	video/mp4	24898037	/uploads/7dce1851-f3ad-40f5-851f-4a3b062356de.mp4	2026-03-26 18:31:05.014321
9	54219806	464eb266-a570-4586-9d34-a39c0428bb6d.jpg	images (18).jpg	image/jpeg	10990	/uploads/464eb266-a570-4586-9d34-a39c0428bb6d.jpg	2026-03-26 18:46:07.841813
10	54219806	bd3e2dde-e766-40ae-be56-e7febdf81e2e.jpg	download (11).jpg	image/jpeg	9426	/uploads/bd3e2dde-e766-40ae-be56-e7febdf81e2e.jpg	2026-03-26 18:46:31.364569
11	54219806	52e364aa-f4bb-49b4-a8cc-860841e851e1.webp	5G-Caramel-Biscuit-copy-300x400-1.webp	image/webp	10228	/uploads/52e364aa-f4bb-49b4-a8cc-860841e851e1.webp	2026-03-26 18:58:35.06986
12	54219806	ffc7ce52-8079-427e-8c6f-862f608cc19b.jpg	0016_Snykers-Chocolate-Cookies-300x400-1.jpg	image/jpeg	17559	/uploads/ffc7ce52-8079-427e-8c6f-862f608cc19b.jpg	2026-03-26 18:58:40.178349
13	54219806	43bf41c6-3530-4172-b4d4-401733bd284e.jpg	download (9).jpg	image/jpeg	5411	/uploads/43bf41c6-3530-4172-b4d4-401733bd284e.jpg	2026-03-26 18:58:50.437504
14	54219806	cbc8deaf-6db5-48ad-8465-6746213f9ce4.jpg	download (13).jpg	image/jpeg	16266	/uploads/cbc8deaf-6db5-48ad-8465-6746213f9ce4.jpg	2026-03-26 18:59:00.773864
15	54219806	dac28486-6dce-4fcf-a3d1-03ab6b51efc0.jpg	download (14).jpg	image/jpeg	3821	/uploads/dac28486-6dce-4fcf-a3d1-03ab6b51efc0.jpg	2026-03-26 18:59:48.856251
16	54219806	4b2c4200-e041-4e91-b2b5-244e7ba63945.webp	5G-Caramel-Biscuit-copy-300x400-1.webp	image/webp	10228	/uploads/4b2c4200-e041-4e91-b2b5-244e7ba63945.webp	2026-03-26 19:08:22.080529
17	54219806	19e9044c-3cff-442c-9674-0dd7e4225975.jpg	0016_Snykers-Chocolate-Cookies-300x400-1.jpg	image/jpeg	17559	/uploads/19e9044c-3cff-442c-9674-0dd7e4225975.jpg	2026-03-26 19:08:22.092634
18	54219806	27f35cf0-5960-45b3-b2c6-004b3fa9cbee.jpg	download (9).jpg	image/jpeg	5411	/uploads/27f35cf0-5960-45b3-b2c6-004b3fa9cbee.jpg	2026-03-26 19:08:22.099213
19	54219806	9353e591-68f8-47ed-b681-438eeced8eca.jpg	download (11).jpg	image/jpeg	9426	/uploads/9353e591-68f8-47ed-b681-438eeced8eca.jpg	2026-03-26 19:08:22.103763
20	54219806	623f58f3-6324-4a55-8383-ac64aa13c953.jpg	download (12).jpg	image/jpeg	12512	/uploads/623f58f3-6324-4a55-8383-ac64aa13c953.jpg	2026-03-26 19:08:22.113098
21	54219806	aad2fbd6-4461-43a1-ad78-ef08419e8e7d.jpg	download (13).jpg	image/jpeg	16266	/uploads/aad2fbd6-4461-43a1-ad78-ef08419e8e7d.jpg	2026-03-26 19:08:22.12512
22	54219806	559f3247-39a9-4f0e-a045-929eb4ec2c61.jpg	download (19).jpg	image/jpeg	4851	/uploads/559f3247-39a9-4f0e-a045-929eb4ec2c61.jpg	2026-03-26 19:08:22.449704
23	54219806	9e19c2b5-bd5d-4e58-95e2-45b87c9e6a8b.jpg	download (15).jpg	image/jpeg	6309	/uploads/9e19c2b5-bd5d-4e58-95e2-45b87c9e6a8b.jpg	2026-03-26 19:08:22.469199
24	54219806	0c3b71b2-85aa-4080-9068-835a2f774b32.jpg	download (16).jpg	image/jpeg	9990	/uploads/0c3b71b2-85aa-4080-9068-835a2f774b32.jpg	2026-03-26 19:08:22.547168
25	54219806	a7911d79-238f-4672-9835-a87e8c9a8fd8.jpg	download (17).jpg	image/jpeg	5467	/uploads/a7911d79-238f-4672-9835-a87e8c9a8fd8.jpg	2026-03-26 19:08:22.565911
26	54219806	71d55423-1aab-4845-a271-4d5e4be47d7e.jpg	download (20).jpg	image/jpeg	10174	/uploads/71d55423-1aab-4845-a271-4d5e4be47d7e.jpg	2026-03-26 19:08:22.579385
27	54219806	9706afb2-1912-4c88-962b-2dd6cff58dd4.jpg	download (21).jpg	image/jpeg	7536	/uploads/9706afb2-1912-4c88-962b-2dd6cff58dd4.jpg	2026-03-26 19:08:22.58715
28	54219806	60560e18-70e8-494e-b3c4-271282e0273b.jpg	download (23).jpg	image/jpeg	12859	/uploads/60560e18-70e8-494e-b3c4-271282e0273b.jpg	2026-03-26 19:08:22.829802
29	54219806	ed6cfda3-ca0c-4841-84e0-18ab53355389.jpg	download (24).jpg	image/jpeg	5135	/uploads/ed6cfda3-ca0c-4841-84e0-18ab53355389.jpg	2026-03-26 19:08:22.951497
30	54219806	e314e3c1-a79b-40e0-abba-056cfad05016.jpg	download (25).jpg	image/jpeg	9386	/uploads/e314e3c1-a79b-40e0-abba-056cfad05016.jpg	2026-03-26 19:08:23.054791
31	54219806	4248e2e7-7cc3-41a4-9bdb-6404c94d9cc5.jpg	download (23).jpg	image/jpeg	12859	/uploads/4248e2e7-7cc3-41a4-9bdb-6404c94d9cc5.jpg	2026-03-26 19:24:03.123272
32	54219806	8e69825b-7ff1-41c0-9a05-39236f6358b1.jpg	download (22).jpg	image/jpeg	7902	/uploads/8e69825b-7ff1-41c0-9a05-39236f6358b1.jpg	2026-03-26 19:24:10.714812
33	54219806	ac285194-9e8d-4471-8723-3b742d312e75.jpg	download (29).jpg	image/jpeg	13812	/uploads/ac285194-9e8d-4471-8723-3b742d312e75.jpg	2026-03-26 19:24:23.607122
34	54219806	f1d423f9-14d0-444d-8a7d-f780c1e0a20d.jpg	download (13).jpg	image/jpeg	16266	/uploads/f1d423f9-14d0-444d-8a7d-f780c1e0a20d.jpg	2026-03-26 19:29:39.687953
35	54219806	b2ec2001-ea4d-4587-a53c-db43aa03502d.jpg	download (12).jpg	image/jpeg	12512	/uploads/b2ec2001-ea4d-4587-a53c-db43aa03502d.jpg	2026-03-26 19:29:45.51372
36	54219806	fc8f0c08-c6dd-47e6-8dde-18d56c3619d3.jpg	download (11).jpg	image/jpeg	9426	/uploads/fc8f0c08-c6dd-47e6-8dde-18d56c3619d3.jpg	2026-03-26 19:29:51.266591
37	54219806	c7bd4ed3-9ddf-4c54-9275-3f4e87833b55.jpg	0016_Snykers-Chocolate-Cookies-300x400-1.jpg	image/jpeg	17559	/uploads/c7bd4ed3-9ddf-4c54-9275-3f4e87833b55.jpg	2026-03-26 19:30:02.274845
38	54219806	ee319043-1810-4728-a70b-f6f9b601583e.jpg	download (20).jpg	image/jpeg	10174	/uploads/ee319043-1810-4728-a70b-f6f9b601583e.jpg	2026-03-26 19:30:12.586784
39	54219806	a97eff28-8f17-45b8-be4f-4c362ecc1202.jpg	download (15).jpg	image/jpeg	6309	/uploads/a97eff28-8f17-45b8-be4f-4c362ecc1202.jpg	2026-03-26 19:30:17.034031
40	54219806	7163429d-83a3-42f1-a88a-1ddbb49c0e00.jpg	1b947998-4c28-4936-8e4b-f9a33d40fcbb.jpg	image/jpeg	38741	/uploads/7163429d-83a3-42f1-a88a-1ddbb49c0e00.jpg	2026-03-26 19:47:10.66649
41	54219806	be1e2643-4eeb-4a48-98a2-ff385708b99b.jpg	0a8530d9-27b4-488d-ac5e-cafd0ae771b6.jpg	image/jpeg	63090	/uploads/be1e2643-4eeb-4a48-98a2-ff385708b99b.jpg	2026-03-26 19:47:10.678764
44	54219806	5a96a0b3-4409-4be0-b703-6840634d81c2.jpg	68a4cdfe-3412-44e9-8520-8eef22577602.jpg	image/jpeg	53073	/uploads/5a96a0b3-4409-4be0-b703-6840634d81c2.jpg	2026-03-26 19:47:34.545645
45	54219806	e34a1af7-c167-4b95-a106-9b8710ee276a.jpg	6f402cde-9730-4988-94b3-ff5050541730.jpg	image/jpeg	48564	/uploads/e34a1af7-c167-4b95-a106-9b8710ee276a.jpg	2026-03-26 19:47:41.827618
50	54219806	1cdf52f4-c3dd-41c1-84f5-03c311ffd343.jpg	42661d3a-18b2-406e-a437-1416890d58c0.jpg	image/jpeg	32529	/uploads/1cdf52f4-c3dd-41c1-84f5-03c311ffd343.jpg	2026-03-26 19:55:24.548474
51	54219806	4c5c0c0b-13b6-4003-960b-b01b8d78f308.webp	Screenshot_Ù¢Ù Ù¢Ù£-Ù Ù¦-Ù¢Ù¦-Ù Ù¦-Ù¢Ù¥-Ù Ù§-Ù¥Ù¡Ù¥-edit_com.google.android.googlequicksearchbox-300x300.webp	image/webp	14424	/uploads/4c5c0c0b-13b6-4003-960b-b01b8d78f308.webp	2026-03-26 20:05:00.56872
52	54219806	7eb6d2a8-11e6-470e-9239-9bbcd7344916.webp	Screenshot_Ù¢Ù Ù¢Ù£-Ù Ù¦-Ù¢Ù¦-Ù Ù¦-Ù¢Ù¥-Ù¤Ù£-Ù¤Ù¥Ù£-edit_com.google.android.googlequicksearchbox-300x300.webp	image/webp	12580	/uploads/7eb6d2a8-11e6-470e-9239-9bbcd7344916.webp	2026-03-26 20:05:00.700117
53	54219806	5d276d76-f6ce-4ee3-a1a5-055a6a755a6b.webp	Screenshot_Ù¢Ù Ù¢Ù£-Ù Ù¦-Ù¢Ù¦-Ù Ù¦-Ù¢Ù£-Ù£Ù -Ù¡Ù¡Ù¨-edit_com.google.android.googlequicksearchbox.webp	image/webp	49968	/uploads/5d276d76-f6ce-4ee3-a1a5-055a6a755a6b.webp	2026-03-26 20:05:00.77813
61	54219806	7e6bfc72-c555-4680-a32c-1840358b6420.jpg	2e0b06b1-ef21-4b6e-b837-e00df15c7347.jpg	image/jpeg	27861	/uploads/7e6bfc72-c555-4680-a32c-1840358b6420.jpg	2026-03-26 20:37:13.787395
62	54219806	21961c4a-0fd9-40fc-addb-00fbdeb02a84.jpg	1b947998-4c28-4936-8e4b-f9a33d40fcbb.jpg	image/jpeg	38741	/uploads/21961c4a-0fd9-40fc-addb-00fbdeb02a84.jpg	2026-03-26 20:37:13.799969
65	54219806	f5591f74-1f95-4cbe-8cc1-2b9c4cb38d2e.jpg	6f402cde-9730-4988-94b3-ff5050541730.jpg	image/jpeg	48564	/uploads/f5591f74-1f95-4cbe-8cc1-2b9c4cb38d2e.jpg	2026-03-26 20:37:14.248939
66	54219806	90181a7d-1cf3-4329-b992-08d950264bac.jpg	7b036268-1879-4f7a-b0e6-a62ea19db3b2.jpg	image/jpeg	42019	/uploads/90181a7d-1cf3-4329-b992-08d950264bac.jpg	2026-03-26 20:37:14.291535
67	54219806	e50cdfa9-7d89-4fc0-804d-af069f6ccbc8.jpg	7d770a38-db6d-4bbb-845a-695a2e24f933.jpg	image/jpeg	25789	/uploads/e50cdfa9-7d89-4fc0-804d-af069f6ccbc8.jpg	2026-03-26 20:37:14.32795
69	54219806	be0d859a-c1b9-45bf-8b47-68ce39d7a820.jpg	09beb622-3d70-4655-b2eb-98f9e5f3caaa.jpg	image/jpeg	28086	/uploads/be0d859a-c1b9-45bf-8b47-68ce39d7a820.jpg	2026-03-26 20:37:14.528909
70	54219806	4111bb4a-1858-4353-bfa7-e73d01ccdc87.jpg	12dc2244-f762-4957-8cb3-57bab36d6907.jpg	image/jpeg	34489	/uploads/4111bb4a-1858-4353-bfa7-e73d01ccdc87.jpg	2026-03-26 20:37:14.650119
71	54219806	1a990140-8c9e-47e1-884b-7c0d1a07859c.jpg	22c0e667-a353-43c9-aa29-6cc8146d3c19.jpg	image/jpeg	33146	/uploads/1a990140-8c9e-47e1-884b-7c0d1a07859c.jpg	2026-03-26 20:37:14.744722
72	54219806	053f16b6-3150-4a9b-b43e-a6a5fdc3f19c.webp	39.webp	image/webp	10882	/uploads/053f16b6-3150-4a9b-b43e-a6a5fdc3f19c.webp	2026-03-26 20:37:14.759526
73	54219806	1df855b8-b9a9-4907-8e7f-5a2f29beadb1.jpg	59f0214a-71d0-4724-bc52-6a9835a1751b.jpg	image/jpeg	34397	/uploads/1df855b8-b9a9-4907-8e7f-5a2f29beadb1.jpg	2026-03-26 20:37:14.853578
81	54219806	cac96811-feb2-4ada-942f-0246e70ed9bd.jpg	0a8530d9-27b4-488d-ac5e-cafd0ae771b6.jpg	image/jpeg	63090	/uploads/cac96811-feb2-4ada-942f-0246e70ed9bd.jpg	2026-03-26 20:53:46.272235
82	54219806	4fa45773-e078-4a82-b17b-1d6739460e1f.jpg	2ff63715-1949-4b30-b3cd-1450992b5d59.jpg	image/jpeg	18354	/uploads/4fa45773-e078-4a82-b17b-1d6739460e1f.jpg	2026-03-28 01:36:57.248579
84	54219806	634e6a26-40cc-4368-beac-0227a4cf3e4b.jpg	2e0b06b1-ef21-4b6e-b837-e00df15c7347.jpg	image/jpeg	27861	/uploads/634e6a26-40cc-4368-beac-0227a4cf3e4b.jpg	2026-03-28 01:36:57.266706
88	54219806	262ece6f-a6a3-4126-aa6d-e75a3b5c297d.jpg	6f402cde-9730-4988-94b3-ff5050541730.jpg	image/jpeg	48564	/uploads/262ece6f-a6a3-4126-aa6d-e75a3b5c297d.jpg	2026-03-28 01:36:57.480877
91	54219806	80323bed-0192-44ac-bd09-ec22f3f326eb.jpg	09beb622-3d70-4655-b2eb-98f9e5f3caaa.jpg	image/jpeg	28086	/uploads/80323bed-0192-44ac-bd09-ec22f3f326eb.jpg	2026-03-28 01:36:57.598246
92	54219806	44c0ea97-8653-42db-8840-1cc8b0cb98e9.jpg	12dc2244-f762-4957-8cb3-57bab36d6907.jpg	image/jpeg	34489	/uploads/44c0ea97-8653-42db-8840-1cc8b0cb98e9.jpg	2026-03-28 01:36:57.611975
95	54219806	ca767300-bc46-48c1-9242-07e3f17fd828.jpg	7b036268-1879-4f7a-b0e6-a62ea19db3b2.jpg	image/jpeg	42019	/uploads/ca767300-bc46-48c1-9242-07e3f17fd828.jpg	2026-03-28 01:57:42.126757
96	54219806	90c7e3cd-54c8-4e3f-858c-e635c82e3e68.jpg	0b72f16d-13a7-40df-a2ad-636b406be687.jpg	image/jpeg	35372	/uploads/90c7e3cd-54c8-4e3f-858c-e635c82e3e68.jpg	2026-03-28 01:59:21.930889
97	54219806	365ddcb2-330e-45e5-8249-5d7158e3aec0.jpg	1b947998-4c28-4936-8e4b-f9a33d40fcbb.jpg	image/jpeg	38741	/uploads/365ddcb2-330e-45e5-8249-5d7158e3aec0.jpg	2026-03-28 01:59:21.952778
98	54219806	2c6cc90a-64d5-4017-b613-a0d3ab7401c7.jpg	2db236b4-659a-418f-8956-10f2b3642e3e.jpg	image/jpeg	38567	/uploads/2c6cc90a-64d5-4017-b613-a0d3ab7401c7.jpg	2026-03-28 01:59:21.970907
99	54219806	61365f42-30d1-4e05-9313-0a21bddba86e.jpg	2e0b06b1-ef21-4b6e-b837-e00df15c7347.jpg	image/jpeg	27861	/uploads/61365f42-30d1-4e05-9313-0a21bddba86e.jpg	2026-03-28 01:59:21.980226
100	54219806	c5ca0c77-596b-45b9-bb94-ac8af52edd6f.jpg	2ff63715-1949-4b30-b3cd-1450992b5d59.jpg	image/jpeg	18354	/uploads/c5ca0c77-596b-45b9-bb94-ac8af52edd6f.jpg	2026-03-28 01:59:21.988713
101	54219806	c4924260-b4d4-4efd-83a7-cdc258efde39.jpg	0a8530d9-27b4-488d-ac5e-cafd0ae771b6.jpg	image/jpeg	63090	/uploads/c4924260-b4d4-4efd-83a7-cdc258efde39.jpg	2026-03-28 01:59:22.082738
102	54219806	735d7e54-aafd-4210-b63b-b4d854327462.jpg	7d770a38-db6d-4bbb-845a-695a2e24f933.jpg	image/jpeg	25789	/uploads/735d7e54-aafd-4210-b63b-b4d854327462.jpg	2026-03-28 01:59:22.191366
103	54219806	bc211d97-f3ec-4bc3-9c38-b744cad3871d.jpg	8e980a1b-34dc-428d-8b3f-e42068e31c60.jpg	image/jpeg	22540	/uploads/bc211d97-f3ec-4bc3-9c38-b744cad3871d.jpg	2026-03-28 01:59:22.285458
104	54219806	a9f82b11-c4a8-41c7-88b0-12ceec9f5c6b.jpg	09beb622-3d70-4655-b2eb-98f9e5f3caaa.jpg	image/jpeg	28086	/uploads/a9f82b11-c4a8-41c7-88b0-12ceec9f5c6b.jpg	2026-03-28 01:59:22.321414
105	54219806	5be443e4-8e52-46e1-a5c7-7907bfee394c.jpg	12dc2244-f762-4957-8cb3-57bab36d6907.jpg	image/jpeg	34489	/uploads/5be443e4-8e52-46e1-a5c7-7907bfee394c.jpg	2026-03-28 01:59:22.335288
106	54219806	f04a2dfa-b285-408e-b354-e86fd932796b.jpg	6f402cde-9730-4988-94b3-ff5050541730.jpg	image/jpeg	48564	/uploads/f04a2dfa-b285-408e-b354-e86fd932796b.jpg	2026-03-28 01:59:22.352185
107	54219806	0f574451-f7df-4f67-8046-e2eb7f7733c2.jpg	7b036268-1879-4f7a-b0e6-a62ea19db3b2.jpg	image/jpeg	42019	/uploads/0f574451-f7df-4f67-8046-e2eb7f7733c2.jpg	2026-03-28 01:59:22.35712
108	54219806	8c49fc6a-e6d3-4cea-a376-229bd3b99428.jpg	22c0e667-a353-43c9-aa29-6cc8146d3c19.jpg	image/jpeg	33146	/uploads/8c49fc6a-e6d3-4cea-a376-229bd3b99428.jpg	2026-03-28 01:59:22.445252
109	54219806	33338e7f-62cf-4a21-8ed5-31e6a56492b7.webp	39.webp	image/webp	10882	/uploads/33338e7f-62cf-4a21-8ed5-31e6a56492b7.webp	2026-03-28 01:59:22.500739
110	54219806	9ef58439-dc89-4b92-8ad8-c61c4e4691c8.jpg	59f0214a-71d0-4724-bc52-6a9835a1751b.jpg	image/jpeg	34397	/uploads/9ef58439-dc89-4b92-8ad8-c61c4e4691c8.jpg	2026-03-28 01:59:22.542259
111	54165148	22959470-97f2-460f-b92f-e14988e65ec3.jpg	1000143937.jpg	image/jpeg	69976	/uploads/22959470-97f2-460f-b92f-e14988e65ec3.jpg	2026-03-28 05:03:01.867727
112	54165148	63b3e20f-8d96-47f6-a011-c7fb38871d0f.jpg	1000143929.jpg	image/jpeg	78427	/uploads/63b3e20f-8d96-47f6-a011-c7fb38871d0f.jpg	2026-03-28 05:03:03.40946
113	54165148	db60044e-53b3-47c8-8bdd-59e668310f9c.jpg	1000143939.jpg	image/jpeg	85685	/uploads/db60044e-53b3-47c8-8bdd-59e668310f9c.jpg	2026-03-28 05:03:03.784015
114	54165148	5fcd813e-331f-4dd9-badd-059b86324ec4.jpg	1000143927.jpg	image/jpeg	74498	/uploads/5fcd813e-331f-4dd9-badd-059b86324ec4.jpg	2026-03-28 05:03:04.00882
115	54165148	a41c7e68-d3b4-4933-8bdc-ce04e735ee4c.jpg	1000143931.jpg	image/jpeg	78738	/uploads/a41c7e68-d3b4-4933-8bdc-ce04e735ee4c.jpg	2026-03-28 05:03:05.191897
116	54165148	43f1e131-f564-4350-a403-85a99c9ee25c.jpg	1000143933.jpg	image/jpeg	191498	/uploads/43f1e131-f564-4350-a403-85a99c9ee25c.jpg	2026-03-28 05:03:07.076119
117	54165148	67db1e1c-ee24-4055-bb88-3066df33c810.jpg	1000143935.jpg	image/jpeg	223277	/uploads/67db1e1c-ee24-4055-bb88-3066df33c810.jpg	2026-03-28 05:03:07.54801
118	54165148	65206b1f-2b38-4ddf-bc6c-86a4fd7a9ba5.webm	voice-1774817962225.webm	audio/webm	19623	/uploads/65206b1f-2b38-4ddf-bc6c-86a4fd7a9ba5.webm	2026-03-29 20:59:22.568055
119	54219806	b999238b-bd25-4d7c-b02a-559586da859f.jpg	Hailuo_Image_Ø§ÙØ´Ø§Ø¡ ÙØ¯ÙÙ Ø§Ø­ØªØ±Ø§ÙÙ  ÙØªÙÙÙ Ø¹Ù Ø¹_455282152648179713 (2).jpg	image/jpeg	713535	/uploads/b999238b-bd25-4d7c-b02a-559586da859f.jpg	2026-03-29 23:56:58.659693
120	54219806	589b2684-7e78-4518-a2f9-c22db63e143f.jpg	1 (1).jpg	image/jpeg	19198	/uploads/589b2684-7e78-4518-a2f9-c22db63e143f.jpg	2026-03-29 23:57:18.554395
121	54219806	f298ad3a-dfda-4d05-9a24-6a1939ac9642.webp	1580016246NiNRD-2.webp	image/webp	8324	/uploads/f298ad3a-dfda-4d05-9a24-6a1939ac9642.webp	2026-03-29 23:57:41.295538
122	54219806	d150a778-9f13-494e-a5f7-26da9c3fc818.webp	1000054013.webp	image/webp	3884	/uploads/d150a778-9f13-494e-a5f7-26da9c3fc818.webp	2026-03-29 23:57:50.825536
123	54219806	745ab61d-f47a-4578-b623-b91f3fb1b213.jpg	61TEazg2PxL._AC_UF894,1000_QL80_.jpg	image/jpeg	49984	/uploads/745ab61d-f47a-4578-b623-b91f3fb1b213.jpg	2026-03-29 23:58:01.30583
124	54219806	5cfd3878-513c-48ed-ab21-509052b95489.webp	1580016246NiNRD-2.webp	image/webp	8324	/uploads/5cfd3878-513c-48ed-ab21-509052b95489.webp	2026-03-30 00:07:16.399882
125	54219806	75aa1ecb-777b-4f12-b523-a0bf0f726c28.webp	1554247137_-175-500x500-1.webp	image/webp	1904	/uploads/75aa1ecb-777b-4f12-b523-a0bf0f726c28.webp	2026-03-30 00:07:21.997149
126	54219806	817ff449-3cd2-4b0b-a9d0-809295f25e7e.webp	482308_main.webp	image/webp	6724	/uploads/817ff449-3cd2-4b0b-a9d0-809295f25e7e.webp	2026-03-30 00:07:31.321003
127	54219806	ff7276c0-c31a-44c1-879a-05e7d5582e9a.png	2024-05-01-66328e6486a19.png	image/png	255116	/uploads/ff7276c0-c31a-44c1-879a-05e7d5582e9a.png	2026-03-30 00:07:40.418552
128	54219806	b76001d6-bc57-470b-a49a-e06752e8bf54.jpg	Ø¬ÙÙÙØ© Ø§ØªØ±.jpg	image/jpeg	35155	/uploads/b76001d6-bc57-470b-a49a-e06752e8bf54.jpg	2026-03-31 14:54:00.368519
129	54219806	15138be5-a7ad-4512-958b-22c512e2ffd2.webp	5022.webp	image/webp	9518	/uploads/15138be5-a7ad-4512-958b-22c512e2ffd2.webp	2026-03-31 22:35:44.047647
130	54219806	f5a4988d-e1fa-4ce5-ad35-e3167d4c9a3b.webp	5185.webp	image/webp	4816	/uploads/f5a4988d-e1fa-4ce5-ad35-e3167d4c9a3b.webp	2026-03-31 22:35:44.048389
131	54219806	2953a340-d56f-49ee-b090-1c87e9cac141.webp	5023.webp	image/webp	7210	/uploads/2953a340-d56f-49ee-b090-1c87e9cac141.webp	2026-03-31 22:35:44.051604
132	54219806	41c8617b-d6dd-4aa6-81cb-6e24042f7407.webp	5076.webp	image/webp	6190	/uploads/41c8617b-d6dd-4aa6-81cb-6e24042f7407.webp	2026-03-31 22:35:44.054791
133	54219806	38c3fb07-4a0d-4257-ace9-255ef7ee85fb.webp	5075.webp	image/webp	4280	/uploads/38c3fb07-4a0d-4257-ace9-255ef7ee85fb.webp	2026-03-31 22:35:44.109164
134	54219806	a1e05322-0fe1-4ebe-a0a9-e4835ca0d798.webp	5187.webp	image/webp	4604	/uploads/a1e05322-0fe1-4ebe-a0a9-e4835ca0d798.webp	2026-03-31 22:35:44.109041
135	54219806	34e04289-9e6d-4de5-8d87-6923620eacb0.webp	5204.webp	image/webp	6278	/uploads/34e04289-9e6d-4de5-8d87-6923620eacb0.webp	2026-03-31 22:35:44.300205
136	54219806	436aa9db-3a61-4387-b86f-da8e6da87a22.webp	5207.webp	image/webp	3416	/uploads/436aa9db-3a61-4387-b86f-da8e6da87a22.webp	2026-03-31 22:35:44.311529
137	54219806	cf800cc6-e2a2-450b-85ee-0cc598ba1097.webp	5202.webp	image/webp	4150	/uploads/cf800cc6-e2a2-450b-85ee-0cc598ba1097.webp	2026-03-31 22:35:44.313956
138	54219806	ddff22d4-29cb-473d-b8ff-b8aad97bbf8a.webp	5208.webp	image/webp	8318	/uploads/ddff22d4-29cb-473d-b8ff-b8aad97bbf8a.webp	2026-03-31 22:35:44.316232
139	54219806	11399367-0fba-49fd-8f75-30566364c245.webp	5049.webp	image/webp	8624	/uploads/11399367-0fba-49fd-8f75-30566364c245.webp	2026-03-31 22:35:44.322463
140	54219806	5ee52a13-19e9-4eef-8884-9258640a04d0.webp	5188.webp	image/webp	5338	/uploads/5ee52a13-19e9-4eef-8884-9258640a04d0.webp	2026-03-31 22:35:44.326006
141	54219806	079086e6-ed37-41d7-9470-ef0d5891cbe4.webp	5199.webp	image/webp	8968	/uploads/079086e6-ed37-41d7-9470-ef0d5891cbe4.webp	2026-03-31 22:35:44.500262
142	54219806	966b28c0-abf7-4a5b-a031-2f1e74a49e4b.webp	5200.webp	image/webp	7860	/uploads/966b28c0-abf7-4a5b-a031-2f1e74a49e4b.webp	2026-03-31 22:35:44.515337
143	54219806	9ff1acb2-b94a-4be7-9e24-272fc5bc9280.png	Blue Simple Minimalist Weâre Hiring Instagram Post.png	image/png	401733	/uploads/9ff1acb2-b94a-4be7-9e24-272fc5bc9280.png	2026-04-01 03:29:12.362491
144	54165148	658e0a92-e4de-48f8-a909-5c9580f7df62.jpg	1000732724.jpg	image/jpeg	129457	/uploads/658e0a92-e4de-48f8-a909-5c9580f7df62.jpg	2026-04-02 12:13:49.524439
145	54219806	5e627c17-3c4a-4fc3-bfa8-60b4d1627442.png	0spHNNlOLXqiiap1nmW2AE13m27mdsaObL6yaiWg.png	image/png	74534	/uploads/5e627c17-3c4a-4fc3-bfa8-60b4d1627442.png	2026-04-02 21:30:30.058403
147	54219806	0802b96c-bb9a-4824-95c8-244ef8681e55.jpg	678adec6-83c8-459f-bb5f-219c3a7dde23.jpg	image/jpeg	40016	/uploads/0802b96c-bb9a-4824-95c8-244ef8681e55.jpg	2026-04-02 21:34:40.520836
148	54219806	c98048cb-fc9e-4425-af6c-31d52ff3f028.webp	0cd9aa72-f00a-4687-a36e-a6d14e5a1a0d-5201.webp	image/webp	7274	/uploads/c98048cb-fc9e-4425-af6c-31d52ff3f028.webp	2026-04-02 21:55:44.796667
149	54219806	dc9e73d4-59c4-425d-8926-50da3209c3b1.jpg	0a67cab9-b87c-4b29-be4b-48bbd20896c8.jpg	image/jpeg	25716	/uploads/dc9e73d4-59c4-425d-8926-50da3209c3b1.jpg	2026-04-02 21:55:59.718993
150	54219806	f226027c-fa18-4995-8a56-dda8e437123d.jpeg	a4d7d0a0-f7fd-4ed1-891e-a65a3bd75af8.jpeg	image/jpeg	80714	/uploads/f226027c-fa18-4995-8a56-dda8e437123d.jpeg	2026-04-02 22:00:56.452165
151	54219806	83dc1667-d856-4b73-8d4f-75b372c511cf.mp4	Ø§Ø¹ÙÙ Ø¯Ø±Ø¬Ø§Øª Ø§ÙØ·Ø¨ÙØ© Ø§ÙØµÙØªÙØ© Ø³ÙØ±Ø© Ø§ÙÙØ¨Ø§ ÙØ§ÙØ§Ø¹ÙÛ ÙØ§ÙØ·Ø§Ø±Ù ÙØ­ÙØ¯ Ø¬ÙØ§Ø¯ Ø­Ø³ÛÙÛ.mp4	video/mp4	56315028	/uploads/83dc1667-d856-4b73-8d4f-75b372c511cf.mp4	2026-04-02 22:03:16.584901
152	54219806	43f68aaf-2888-45b5-8597-f773f90058d9.jpg	download (6).jpg	image/jpeg	7779	/uploads/43f68aaf-2888-45b5-8597-f773f90058d9.jpg	2026-04-03 00:00:40.778682
153	54219806	6d67520d-66fd-471e-8595-14d7d439db58.jpg	download.jpg	image/jpeg	13256	/uploads/6d67520d-66fd-471e-8595-14d7d439db58.jpg	2026-04-03 00:00:40.886063
154	54219806	a9b84ec8-80fc-49b3-a506-ec776172c210.jpg	download (7).jpg	image/jpeg	10607	/uploads/a9b84ec8-80fc-49b3-a506-ec776172c210.jpg	2026-04-03 00:00:40.903248
155	54219806	a569b907-90e2-489b-8faa-0574c9c64ea6.jpg	download (8).jpg	image/jpeg	10328	/uploads/a569b907-90e2-489b-8faa-0574c9c64ea6.jpg	2026-04-03 00:00:40.911156
156	54219806	a4274ed8-193f-4b9b-bec4-63794c88c8ca.jpg	Hailuo_Image_Ø§ÙØ´Ø§Ø¡ ÙØ¯ÙÙ Ø§Ø­ØªØ±Ø§ÙÙ  ÙØªÙÙÙ Ø¹Ù Ø¹_455282152648179713 (2).jpg	image/jpeg	713535	/uploads/a4274ed8-193f-4b9b-bec4-63794c88c8ca.jpg	2026-04-04 05:23:17.857399
157	54219806	98677098-f003-4349-8197-ca997d8ca3c7.webp	Screenshot_Ù¢Ù Ù¢Ù£-Ù Ù¦-Ù¢Ù¦-Ù Ù¦-Ù¢Ù¥-Ù Ù§-Ù¥Ù¡Ù¥-edit_com.google.android.googlequicksearchbox-300x300.webp	image/webp	14424	/uploads/98677098-f003-4349-8197-ca997d8ca3c7.webp	2026-04-04 05:27:35.789654
158	54219806	28d32e29-4599-4726-a006-e335af7242e8.webp	image_1920 55.webp	image/webp	13114	/uploads/28d32e29-4599-4726-a006-e335af7242e8.webp	2026-04-04 05:29:04.485269
159	54219806	bdc617b1-444d-4b77-817c-4f159a873ebd.png	Blue Simple Minimalist Weâre Hiring Instagram Post.png	image/png	401733	/uploads/bdc617b1-444d-4b77-817c-4f159a873ebd.png	2026-04-05 21:02:20.804268
160	54165148	91340421-2d0d-4bd6-bea7-a5ea116f0df8.png	Blue Simple Minimalist Weâre Hiring Instagram Post (2)555.png	image/png	393589	/uploads/91340421-2d0d-4bd6-bea7-a5ea116f0df8.png	2026-04-07 19:30:14.863434
161	54219806	7b4c786c-e119-4f88-8773-8a4702baa5df.jpg	Hailuo_Image_Ø³ÙÙ ÙØ§Ø±ÙØ§Øª_ ØªØ·Ø¨ÙÙÙ Ø§ÙØ´Ø§ÙÙ ÙÙÙ _455307867611455494.jpg	image/jpeg	667950	/uploads/7b4c786c-e119-4f88-8773-8a4702baa5df.jpg	2026-04-07 20:00:27.089732
162	54219806	4a57d3ce-1d8e-4d50-82df-df0478fd5aae.jpg	1 (1).jpg	image/jpeg	19198	/uploads/4a57d3ce-1d8e-4d50-82df-df0478fd5aae.jpg	2026-04-07 20:00:43.539465
163	54219806	b477223d-7012-42a6-9902-6d3c978b0963.jpg	1.jpg	image/jpeg	14394	/uploads/b477223d-7012-42a6-9902-6d3c978b0963.jpg	2026-04-07 20:00:55.350004
164	54219806	89d6a2a0-8f21-43f0-ad55-3033b5c317cd.jpg	465709107_1397746924518022_321368696331651203_n.jpg	image/jpeg	6620	/uploads/89d6a2a0-8f21-43f0-ad55-3033b5c317cd.jpg	2026-04-07 20:01:17.351893
165	54219806	3598cf17-540b-44f1-8d46-9f071a1e3762.jpg	465715027_1397751407850907_6231460844284659744_n 1280.jpg	image/jpeg	222777	/uploads/3598cf17-540b-44f1-8d46-9f071a1e3762.jpg	2026-04-07 20:01:37.406205
166	54165148	dd0b71b7-0049-4411-873f-3286cd50c8b1.jpg	1000146964.jpg	image/jpeg	15366	/uploads/dd0b71b7-0049-4411-873f-3286cd50c8b1.jpg	2026-04-08 02:20:36.607321
167	54219806	edb2b2df-5d2c-4881-80ef-49d3c4abd124.jpg	597381517_122151662858709457_5284665421119515906_n.jpg	image/jpeg	668458	/uploads/edb2b2df-5d2c-4881-80ef-49d3c4abd124.jpg	2026-04-09 20:23:06.950381
168	54219806	300fbae5-db95-4f76-885b-89d5688ebc40.png	3c2b399b-ca54-4b33-ab27-75d6e4ad24ae.png	image/png	1122484	/uploads/300fbae5-db95-4f76-885b-89d5688ebc40.png	2026-04-12 00:39:36.317666
169	54219806	634b098d-68d2-45e3-ad41-62d7cc0d7132.png	3c2b399b-ca54-4b33-ab27-75d6e4ad24ae.png	image/png	1122484	/uploads/634b098d-68d2-45e3-ad41-62d7cc0d7132.png	2026-04-12 00:42:44.61155
170	54219806	1626ce57-59a9-4605-b362-42ea39803dd3.jpg	ØµÙØ± Ø°ÙØ§Ø¡.jpg	image/jpeg	449665	/uploads/1626ce57-59a9-4605-b362-42ea39803dd3.jpg	2026-04-12 00:52:27.134498
171	54219806	41805448-90b6-40e3-b987-552d0dbd56b4.jpg	ØµÙØ± Ø°ÙØ§Ø¡.jpg	image/jpeg	449665	/uploads/41805448-90b6-40e3-b987-552d0dbd56b4.jpg	2026-04-12 00:53:03.063397
172	54219806	516b1e51-d06e-48ef-ba73-df3ab34ba194.png	logo.png	image/png	74534	/uploads/516b1e51-d06e-48ef-ba73-df3ab34ba194.png	2026-04-12 22:16:03.826805
173	54219806	eec38c09-3dcb-4334-9874-323f904b3bac.png	logo.png	image/png	74534	/uploads/eec38c09-3dcb-4334-9874-323f904b3bac.png	2026-04-12 22:18:23.775385
174	54219806	24dec932-d2cf-4578-ba02-08d8056b084c.png	googleplay.png	image/png	4209	/uploads/24dec932-d2cf-4578-ba02-08d8056b084c.png	2026-04-12 22:23:30.213546
175	54219806	2fb464ac-adf7-4bfa-b7f6-f1ec300628ce.png	3c2b399b-ca54-4b33-ab27-75d6e4ad24ae.png	image/png	1122484	/uploads/2fb464ac-adf7-4bfa-b7f6-f1ec300628ce.png	2026-04-12 23:12:07.629047
177	54219806	22cc1f3b-265c-46e7-9682-83ae6106fde3.webp	ÙØ´Ø±ÙÙ.webp	image/webp	8158	/uploads/22cc1f3b-265c-46e7-9682-83ae6106fde3.webp	2026-04-13 02:13:03.520505
178	54219806	e0576d01-8381-42d7-ab66-a0f0a09f1ac4.png	googleplay.png	image/png	4209	/uploads/e0576d01-8381-42d7-ab66-a0f0a09f1ac4.png	2026-04-13 02:17:51.35256
179	f1bea370-0eff-4578-9bc0-e9034e32d9fd	73f66e38-f5b7-4930-ba57-e2751de13dd6.jpg	Screenshot_2026-04-08-18-39-08-34_f9ee0578fe1cc94de7482bd41accb329.jpg	image/jpeg	148292	/uploads/73f66e38-f5b7-4930-ba57-e2751de13dd6.jpg	2026-04-13 16:14:43.392989
180	f1bea370-0eff-4578-9bc0-e9034e32d9fd	03cbdcb0-29ef-49ea-a9be-235c68f5744f.jpg	Screenshot_2026-03-18-06-02-58-51_b2982762ac851fa27deabc856cd0808c.jpg	image/jpeg	592005	/uploads/03cbdcb0-29ef-49ea-a9be-235c68f5744f.jpg	2026-04-13 16:14:44.609123
181	f1bea370-0eff-4578-9bc0-e9034e32d9fd	b650957f-69a0-44ec-9212-155aead77884.jpg	Screenshot_2026-04-12-17-00-41-64_f9ee0578fe1cc94de7482bd41accb329.jpg	image/jpeg	279994	/uploads/b650957f-69a0-44ec-9212-155aead77884.jpg	2026-04-13 16:14:46.779891
182	f1bea370-0eff-4578-9bc0-e9034e32d9fd	6e1bc6a8-8e96-4057-9a79-01afb7adfc5a.jpg	IMG20260405122407.jpg	image/jpeg	3108113	/uploads/6e1bc6a8-8e96-4057-9a79-01afb7adfc5a.jpg	2026-04-13 16:14:46.929733
183	f1bea370-0eff-4578-9bc0-e9034e32d9fd	9a257047-822d-49a5-97e1-1cdb88986a24.jpg	Screenshot_2026-04-12-17-04-48-59_f9ee0578fe1cc94de7482bd41accb329.jpg	image/jpeg	656434	/uploads/9a257047-822d-49a5-97e1-1cdb88986a24.jpg	2026-04-13 16:23:28.393625
184	f1bea370-0eff-4578-9bc0-e9034e32d9fd	80879150-781b-4698-915a-dc359d29f2a4.jpg	Screenshot_2026-04-12-17-04-48-59_f9ee0578fe1cc94de7482bd41accb329.jpg	image/jpeg	656434	/uploads/80879150-781b-4698-915a-dc359d29f2a4.jpg	2026-04-13 16:24:33.739299
185	f1bea370-0eff-4578-9bc0-e9034e32d9fd	d2f0efe0-4b43-4909-b6a4-fb80d17bc231.jpg	Screenshot_2026-04-08-18-39-08-34_f9ee0578fe1cc94de7482bd41accb329.jpg	image/jpeg	148292	/uploads/d2f0efe0-4b43-4909-b6a4-fb80d17bc231.jpg	2026-04-13 17:41:23.803111
186	f1bea370-0eff-4578-9bc0-e9034e32d9fd	08ec17de-72ac-4662-9e35-30bfe6989fce.jpg	IMG20260405122407.jpg	image/jpeg	3108113	/uploads/08ec17de-72ac-4662-9e35-30bfe6989fce.jpg	2026-04-13 17:41:28.679789
187	f1bea370-0eff-4578-9bc0-e9034e32d9fd	6d91fff8-7623-4883-aa3e-9af1b969f262.jpg	Screenshot_2026-03-19-04-02-13-87_50ef9f5a0f3fc24b6f0ffc8843167fe4.jpg	image/jpeg	675003	/uploads/6d91fff8-7623-4883-aa3e-9af1b969f262.jpg	2026-04-13 17:41:29.567776
188	f1bea370-0eff-4578-9bc0-e9034e32d9fd	17846917-f762-4ced-8575-003b6e66949e.jpg	Screenshot_2026-03-18-06-02-07-00_50ef9f5a0f3fc24b6f0ffc8843167fe4.jpg	image/jpeg	666569	/uploads/17846917-f762-4ced-8575-003b6e66949e.jpg	2026-04-13 17:41:30.721238
189	f1bea370-0eff-4578-9bc0-e9034e32d9fd	f63580e4-c6c2-4ec9-bc43-43068117d1da.jpg	Screenshot_2026-03-10-16-52-18-76_b2982762ac851fa27deabc856cd0808c.jpg	image/jpeg	482600	/uploads/f63580e4-c6c2-4ec9-bc43-43068117d1da.jpg	2026-04-13 17:41:35.851347
190	54219806	e4a4d393-7cee-4f29-bcf4-8236f2dd108f.png	logo.png	image/png	74534	/uploads/e4a4d393-7cee-4f29-bcf4-8236f2dd108f.png	2026-04-13 22:52:23.690356
191	54165148	d4455653-5959-45e9-895c-1e4a98817335.png	logo.png	image/png	74534	/uploads/d4455653-5959-45e9-895c-1e4a98817335.png	2026-04-13 22:55:53.473366
192	54165148	1baa5a52-a7f5-4603-8420-8206f1edc130.png	appgallery.png	image/png	37929	/uploads/1baa5a52-a7f5-4603-8420-8206f1edc130.png	2026-04-13 23:30:01.329992
193	54219806	80297882-9a30-49f6-9b87-effe65721d4a.jpeg	3776b187-dcb6-47c8-b524-581340c17e45Ø§ÙØ§ÙØ§Ø³Ø³.jpeg	image/jpeg	535852	/uploads/80297882-9a30-49f6-9b87-effe65721d4a.jpeg	2026-04-14 18:10:00.299077
194	54219806	5345d8da-d63a-47a5-9124-e283f0236cf6.png	scene-1776193883032.png	image/png	311637	/uploads/5345d8da-d63a-47a5-9124-e283f0236cf6.png	2026-04-14 19:11:23.508474
195	54219806	66372e49-be69-4b65-91d7-41d717516348.png	scene-1776194007576.png	image/png	873700	/uploads/66372e49-be69-4b65-91d7-41d717516348.png	2026-04-14 19:13:28.272695
196	54219806	286e1817-5558-431c-b383-cc287e80d025.mp4	Ø¹Ø±Ø¶ Ø§ÙØªØ·Ø¨ÙÙ.mp4	video/mp4	8454260	/uploads/286e1817-5558-431c-b383-cc287e80d025.mp4	2026-04-18 14:29:27.115422
197	54219806	262a7639-bbcb-415c-a39d-b2e8aaea23b5.png	0spHNNlOLXqiiap1nmW2AE13m27mdsaObL6yaiWg.png	image/png	74534	/uploads/262a7639-bbcb-415c-a39d-b2e8aaea23b5.png	2026-04-18 14:37:32.211703
198	54219806	b13bc7c0-edce-4a2b-8596-58e384f5a228.png	unnamed.png	image/png	3017	/uploads/b13bc7c0-edce-4a2b-8596-58e384f5a228.png	2026-04-18 14:40:01.9638
\.


--
-- Data for Name: user_follows; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_follows (id, follower_id, following_id, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, first_name, last_name, profile_image_url, created_at, updated_at, password_hash, phone, is_banned, role, governorate, interests, bio, referral_code, birthday, job_title, company, city, relationship_status, balance_egp, gender, account_type) FROM stdin;
54165148	ahmedesmat.5151@gmail.com	ahmed	mohmed	https://storage.googleapis.com/replit/images/1770139560441_da274ae17a3bab2cfadfbe3f713a611c.jpeg	2026-03-26 00:41:10.321141	2026-03-26 21:50:49.907	$2b$10$SwIOVo1OLiaYTkXO4VUO9.3CBASsDFm501dXs8qzaUGP/tdSh6DmC	\N	f	user	الدقهلية	cars,education,fashion,finance,food,gaming,health,kids,real_estate,sports,tech,travel	\N	088795A3	\N	\N	\N	\N	\N	0	\N	\N
f1bea370-0eff-4578-9bc0-e9034e32d9fd	01034386554	أحمد 	حسين 	\N	2026-04-13 16:04:02.139544	2026-04-13 16:04:02.139544	$2b$10$kmwM0WPuRIpBfWFBGRxRuOQjd2.LHMuYnlDrkX6MSNKGqNCc6Tun6	\N	f	user	\N	cars,education,fashion,finance,food,gaming,health,kids,real_estate,sports,tech,travel	\N	53236B29	\N	\N	\N	\N	\N	0	\N	\N
b093fdc4-7bde-4f30-bf50-801b6b215217	\N	Ahmed	Mewafy	\N	2026-04-05 21:39:04.93782	2026-04-05 21:39:04.93782	$2b$10$RGvJsi.QubeFubuGbw7mSORJJU6RMI9loKAiN6SjkHFdzvNy17wzO	01006597088	f	user	\N	\N	, Hello Teaching Arabic to Non-Native speakers 	F252CA5B	\N	\N	\N	\N	\N	0	\N	\N
db4019e3-eb97-4d90-aac2-4bbe570905b1	sm2@as-souqmarkat.com	محمد	محمدود	\N	2026-04-15 22:41:33.600475	2026-04-15 22:41:33.600475	$2b$10$q3gQnv3IL5dyldaI7.fy0uFQrfGRlP2G3MN/rzFXoB4qhYyZIq1D6	\N	f	user	\N	\N	\N	D78F4578	\N	\N	\N	\N	\N	500	\N	\N
54219806	souqmarkat66@gmail.com	Ahmed	Mohamed	\N	2026-02-04 17:24:09.561562	2026-03-28 14:28:27.724	$2b$10$bVC1F8lscaDiHYgOZENOQuiTSEtCxHS6QdztqYUiuwGzyMkJkZlgq	\N	f	user	الدقهلية	cars,education,fashion,finance,food,gaming,health,kids,real_estate,sports,tech,travel	\N	9BFA6082	\N	\N	\N	\N	\N	100	\N	\N
56d29356-b8a4-4572-a90d-5e9f99e7713f	\N	مصطفى 	محمود	\N	2026-03-29 16:59:23.314482	2026-03-29 16:59:23.314482	$2b$10$mrfqGaHcdKpnUdqcWPiSvOin8eyEhzVGT9TWSqFIDIRCebJY.beJu	01285558567	f	user	\N	\N	\N	ED8A5A36	\N	\N	\N	\N	\N	0	\N	\N
541ad010-4694-4b7b-8574-63c29da5320c	demo@example.com	Demo	User	\N	2026-02-04 17:21:37.939947	2026-02-04 17:21:37.939947	\N	\N	t	user	\N	\N	\N	9D70ACEB	\N	\N	\N	\N	\N	0	\N	\N
\.


--
-- Data for Name: wallet_top_up_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wallet_top_up_orders (id, user_id, amount_egp, payment_method, payment_ref, screenshot_url, status, admin_note, order_number, created_at, reviewed_at, reviewed_by) FROM stdin;
1	54219806	100	instapay	152	/uploads/e4a4d393-7cee-4f29-bcf4-8236f2dd108f.png	approved	\N	WLT-MNXSFN5F-TRNB	2026-04-13 22:52:26.739771	2026-04-13 22:54:05.216152	54219806
2	db4019e3-eb97-4d90-aac2-4bbe570905b1	500	vodafone	65uy	\N	approved	\N	WLT-MO0OA858-UQI6	2026-04-15 23:19:34.076878	2026-04-15 23:20:03.27705	54219806
\.


--
-- Data for Name: wallet_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wallet_transactions (id, user_id, type, amount_egp, description, ref_id, created_at) FROM stdin;
1	54219806	top_up	100	شحن محفظة — instapay	WLT-MNXSFN5F-TRNB	2026-04-13 22:54:05.216152
2	db4019e3-eb97-4d90-aac2-4bbe570905b1	top_up	500	شحن محفظة — vodafone	WLT-MO0OA858-UQI6	2026-04-15 23:20:03.27705
\.


--
-- Name: ad_campaigns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ad_campaigns_id_seq', 2, true);


--
-- Name: ad_impressions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ad_impressions_id_seq', 210, true);


--
-- Name: ad_link_clicks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ad_link_clicks_id_seq', 2, true);


--
-- Name: admin_activity_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admin_activity_log_id_seq', 164, true);


--
-- Name: ads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ads_id_seq', 82, true);


--
-- Name: ai_usage_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ai_usage_id_seq', 190, true);


--
-- Name: boost_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.boost_orders_id_seq', 1, false);


--
-- Name: channel_subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.channel_subscriptions_id_seq', 1, false);


--
-- Name: channels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.channels_id_seq', 5, true);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.chat_messages_id_seq', 19, true);


--
-- Name: coin_packages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.coin_packages_id_seq', 5, true);


--
-- Name: coin_purchase_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.coin_purchase_orders_id_seq', 2, true);


--
-- Name: coin_recharge_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.coin_recharge_codes_id_seq', 40, true);


--
-- Name: coin_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.coin_transactions_id_seq', 22, true);


--
-- Name: coin_wallets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.coin_wallets_id_seq', 16, true);


--
-- Name: comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.comments_id_seq', 11, true);


--
-- Name: consultations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.consultations_id_seq', 1, true);


--
-- Name: conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.conversations_id_seq', 1, false);


--
-- Name: coupons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.coupons_id_seq', 1, false);


--
-- Name: direct_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.direct_messages_id_seq', 8, true);


--
-- Name: favorites_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.favorites_id_seq', 24, true);


--
-- Name: follows_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.follows_id_seq', 6, true);


--
-- Name: fraud_alerts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.fraud_alerts_id_seq', 147, true);


--
-- Name: likes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.likes_id_seq', 100, true);


--
-- Name: live_streams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.live_streams_id_seq', 47, true);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.messages_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 245, true);


--
-- Name: offers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.offers_id_seq', 1, false);


--
-- Name: payment_notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_notifications_id_seq', 2, true);


--
-- Name: payment_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_requests_id_seq', 12, true);


--
-- Name: platform_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.platform_settings_id_seq', 5195, true);


--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.push_subscriptions_id_seq', 1097, true);


--
-- Name: ratings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ratings_id_seq', 68, true);


--
-- Name: reels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.reels_id_seq', 6, true);


--
-- Name: referrals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.referrals_id_seq', 2, true);


--
-- Name: renewal_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.renewal_orders_id_seq', 3, true);


--
-- Name: reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.reports_id_seq', 4, true);


--
-- Name: revenue_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.revenue_transactions_id_seq', 84, true);


--
-- Name: smart_menus_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.smart_menus_id_seq', 1, false);


--
-- Name: stories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stories_id_seq', 1, true);


--
-- Name: story_views_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.story_views_id_seq', 1, true);


--
-- Name: stream_moderation_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stream_moderation_id_seq', 35, true);


--
-- Name: uploaded_files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.uploaded_files_id_seq', 198, true);


--
-- Name: user_follows_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_follows_id_seq', 1, false);


--
-- Name: wallet_top_up_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.wallet_top_up_orders_id_seq', 2, true);


--
-- Name: wallet_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.wallet_transactions_id_seq', 2, true);


--
-- Name: ad_campaigns ad_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_pkey PRIMARY KEY (id);


--
-- Name: ad_impressions ad_impressions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ad_impressions
    ADD CONSTRAINT ad_impressions_pkey PRIMARY KEY (id);


--
-- Name: ad_link_clicks ad_link_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ad_link_clicks
    ADD CONSTRAINT ad_link_clicks_pkey PRIMARY KEY (id);


--
-- Name: admin_activity_log admin_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_activity_log
    ADD CONSTRAINT admin_activity_log_pkey PRIMARY KEY (id);


--
-- Name: ads ads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_pkey PRIMARY KEY (id);


--
-- Name: ai_usage ai_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_pkey PRIMARY KEY (id);


--
-- Name: boost_orders boost_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boost_orders
    ADD CONSTRAINT boost_orders_order_number_key UNIQUE (order_number);


--
-- Name: boost_orders boost_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boost_orders
    ADD CONSTRAINT boost_orders_pkey PRIMARY KEY (id);


--
-- Name: channel_subscriptions channel_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.channel_subscriptions
    ADD CONSTRAINT channel_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: channel_subscriptions channel_subscriptions_user_id_channel_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.channel_subscriptions
    ADD CONSTRAINT channel_subscriptions_user_id_channel_id_key UNIQUE (user_id, channel_id);


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);


--
-- Name: channels channels_publisher_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_publisher_code_key UNIQUE (publisher_code);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: coin_packages coin_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coin_packages
    ADD CONSTRAINT coin_packages_pkey PRIMARY KEY (id);


--
-- Name: coin_purchase_orders coin_purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coin_purchase_orders
    ADD CONSTRAINT coin_purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: coin_recharge_codes coin_recharge_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coin_recharge_codes
    ADD CONSTRAINT coin_recharge_codes_code_key UNIQUE (code);


--
-- Name: coin_recharge_codes coin_recharge_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coin_recharge_codes
    ADD CONSTRAINT coin_recharge_codes_pkey PRIMARY KEY (id);


--
-- Name: coin_transactions coin_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coin_transactions
    ADD CONSTRAINT coin_transactions_pkey PRIMARY KEY (id);


--
-- Name: coin_wallets coin_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coin_wallets
    ADD CONSTRAINT coin_wallets_pkey PRIMARY KEY (id);


--
-- Name: coin_wallets coin_wallets_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coin_wallets
    ADD CONSTRAINT coin_wallets_user_id_key UNIQUE (user_id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: consultations consultations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: direct_messages direct_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_user_id_ad_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_ad_id_key UNIQUE (user_id, ad_id);


--
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (id);


--
-- Name: fraud_alerts fraud_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fraud_alerts
    ADD CONSTRAINT fraud_alerts_pkey PRIMARY KEY (id);


--
-- Name: likes likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_pkey PRIMARY KEY (id);


--
-- Name: live_streams live_streams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.live_streams
    ADD CONSTRAINT live_streams_pkey PRIMARY KEY (id);


--
-- Name: live_streams live_streams_stream_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.live_streams
    ADD CONSTRAINT live_streams_stream_key_key UNIQUE (stream_key);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offers offers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_pkey PRIMARY KEY (id);


--
-- Name: payment_notifications payment_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_notifications
    ADD CONSTRAINT payment_notifications_pkey PRIMARY KEY (id);


--
-- Name: payment_requests payment_requests_order_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_order_number_key UNIQUE (order_number);


--
-- Name: payment_requests payment_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_key_key UNIQUE (key);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: ratings ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_pkey PRIMARY KEY (id);


--
-- Name: ratings ratings_user_id_target_type_target_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_user_id_target_type_target_id_key UNIQUE (user_id, target_type, target_id);


--
-- Name: reels reels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reels
    ADD CONSTRAINT reels_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: renewal_orders renewal_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.renewal_orders
    ADD CONSTRAINT renewal_orders_order_number_key UNIQUE (order_number);


--
-- Name: renewal_orders renewal_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.renewal_orders
    ADD CONSTRAINT renewal_orders_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: revenue_transactions revenue_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.revenue_transactions
    ADD CONSTRAINT revenue_transactions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: smart_menus smart_menus_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.smart_menus
    ADD CONSTRAINT smart_menus_pkey PRIMARY KEY (id);


--
-- Name: smart_menus smart_menus_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.smart_menus
    ADD CONSTRAINT smart_menus_slug_key UNIQUE (slug);


--
-- Name: stories stories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_pkey PRIMARY KEY (id);


--
-- Name: story_views story_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_views
    ADD CONSTRAINT story_views_pkey PRIMARY KEY (id);


--
-- Name: story_views story_views_story_id_viewer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_views
    ADD CONSTRAINT story_views_story_id_viewer_id_key UNIQUE (story_id, viewer_id);


--
-- Name: stream_moderation stream_moderation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stream_moderation
    ADD CONSTRAINT stream_moderation_pkey PRIMARY KEY (id);


--
-- Name: uploaded_files uploaded_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.uploaded_files
    ADD CONSTRAINT uploaded_files_pkey PRIMARY KEY (id);


--
-- Name: user_follows user_follows_follower_id_following_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_follows
    ADD CONSTRAINT user_follows_follower_id_following_id_key UNIQUE (follower_id, following_id);


--
-- Name: user_follows user_follows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_follows
    ADD CONSTRAINT user_follows_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wallet_top_up_orders wallet_top_up_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_top_up_orders
    ADD CONSTRAINT wallet_top_up_orders_pkey PRIMARY KEY (id);


--
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- Name: idx_ad_link_clicks_ad_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ad_link_clicks_ad_id ON public.ad_link_clicks USING btree (ad_id);


--
-- Name: idx_ad_link_clicks_ip_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ad_link_clicks_ip_type ON public.ad_link_clicks USING btree (ip, link_type, ad_id, created_at);


--
-- Name: idx_cs_channel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cs_channel ON public.channel_subscriptions USING btree (channel_id);


--
-- Name: idx_cs_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cs_user ON public.channel_subscriptions USING btree (user_id);


--
-- Name: idx_dm_users; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dm_users ON public.direct_messages USING btree (from_user_id, to_user_id);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, is_read);


--
-- Name: ad_campaigns ad_campaigns_advertiser_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_advertiser_id_users_id_fk FOREIGN KEY (advertiser_id) REFERENCES public.users(id);


--
-- Name: ads ads_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: ai_usage ai_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: channels channels_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: chat_messages chat_messages_stream_id_live_streams_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_stream_id_live_streams_id_fk FOREIGN KEY (stream_id) REFERENCES public.live_streams(id);


--
-- Name: chat_messages chat_messages_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: coin_recharge_codes coin_recharge_codes_used_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coin_recharge_codes
    ADD CONSTRAINT coin_recharge_codes_used_by_user_id_fkey FOREIGN KEY (used_by_user_id) REFERENCES public.users(id);


--
-- Name: coin_transactions coin_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coin_transactions
    ADD CONSTRAINT coin_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: coin_wallets coin_wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coin_wallets
    ADD CONSTRAINT coin_wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: comments comments_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: coupons coupons_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: follows follows_channel_id_channels_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_channel_id_channels_id_fk FOREIGN KEY (channel_id) REFERENCES public.channels(id);


--
-- Name: follows follows_follower_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_id_users_id_fk FOREIGN KEY (follower_id) REFERENCES public.users(id);


--
-- Name: likes likes_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: live_streams live_streams_channel_id_channels_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.live_streams
    ADD CONSTRAINT live_streams_channel_id_channels_id_fk FOREIGN KEY (channel_id) REFERENCES public.channels(id);


--
-- Name: live_streams live_streams_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.live_streams
    ADD CONSTRAINT live_streams_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: messages messages_conversation_id_conversations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_conversations_id_fk FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: payment_notifications payment_notifications_ad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_notifications
    ADD CONSTRAINT payment_notifications_ad_id_fkey FOREIGN KEY (ad_id) REFERENCES public.ads(id);


--
-- Name: payment_requests payment_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: reels reels_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reels
    ADD CONSTRAINT reels_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: reports reports_reporter_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_id_users_id_fk FOREIGN KEY (reporter_id) REFERENCES public.users(id);


--
-- Name: revenue_transactions revenue_transactions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.revenue_transactions
    ADD CONSTRAINT revenue_transactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: smart_menus smart_menus_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.smart_menus
    ADD CONSTRAINT smart_menus_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: stories stories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: story_views story_views_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_views
    ADD CONSTRAINT story_views_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id);


--
-- Name: story_views story_views_viewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_views
    ADD CONSTRAINT story_views_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES public.users(id);


--
-- Name: uploaded_files uploaded_files_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.uploaded_files
    ADD CONSTRAINT uploaded_files_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_follows user_follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_follows
    ADD CONSTRAINT user_follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.users(id);


--
-- Name: user_follows user_follows_following_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_follows
    ADD CONSTRAINT user_follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.users(id);


--
-- Name: wallet_top_up_orders wallet_top_up_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_top_up_orders
    ADD CONSTRAINT wallet_top_up_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: wallet_transactions wallet_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict oWD4EJcHkCNdEHDeZ2vsapaMIwATjb1Ryuh4Oui8MjhfOtajefRqxF5b4TBYkeT

