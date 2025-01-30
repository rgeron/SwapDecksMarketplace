require("dotenv").config();
const express = require("express");
const Stripe = require("stripe");

const router = express.Router();
router.use(express.json());

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing Stripe secret key");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Create a Stripe Express Connect account (for individuals)
router.post("/create-connect-account", async (req, res) => {
  try {
    const { email } = req.body;

    const account = await stripe.accounts.create({
      type: "express",
      country: "FR",
      email,
      business_type: "individual",
      controller: { type: "application" }, // Platform controls transactions
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    res.json({ accountId: account.id });
  } catch (error) {
    console.error("Error creating Connect account:", error);
    res.status(500).json({ error: error.message });
  }
});

// Generate an onboarding link for user verification
router.post("/create-onboarding-link", async (req, res) => {
  try {
    const { accountId } = req.body;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.CLIENT_URL}/onboarding/refresh`,
      return_url: `${process.env.CLIENT_URL}/onboarding/complete`,
      type: "account_onboarding",
    });

    res.json({ url: accountLink.url });
  } catch (error) {
    console.error("Error creating onboarding link:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create a checkout session for balance recharge
router.post("/create-checkout-session", async (req, res) => {
  try {
    const { userId, amount } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: "Add Credits to your balance" },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/app/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/app/purchase-cancelled`,
      metadata: { userId, type: "recharge" },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: error.message });
  }
});

// Process product purchase and transfer money to the seller
router.post("/process-purchase", async (req, res) => {
  try {
    const { amount, accountId } = req.body;

    const sellerAmount = Math.round(amount * 0.9 * 100); // 90% to seller, in cents

    const transfer = await stripe.transfers.create({
      amount: sellerAmount,
      currency: "eur",
      destination: accountId,
      description: "Product sale TEST STRIPE",
    });

    res.json({ success: true, transfer });
  } catch (error) {
    console.error("Error processing purchase:", error);
    res.status(500).json({ error: error.message });
  }
});

// Initiate a payout from a seller's Stripe account to their bank
router.post("/create-payout", async (req, res) => {
  try {
    const { amount, accountId } = req.body;

    const payout = await stripe.payouts.create(
      {
        amount: Math.round(amount * 100),
        currency: "eur", // Updated to EUR
      },
      { stripeAccount: accountId }
    );

    res.json({ success: true, payout });
  } catch (error) {
    console.error("Error creating payout:", error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook handler for Stripe events
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const { userId, type } = session.metadata;
          const amount = session.amount_total / 100; // Convert from cents

          console.log(
            `✅ Checkout complete for User ${userId} - Type: ${type}, Amount: ${amount}`
          );
          break;
        }

        case "account.updated": {
          const account = event.data.object;
          console.log(
            `🔄 Account ${account.id} updated: Charges Enabled: ${account.charges_enabled}, Payouts Enabled: ${account.payouts_enabled}`
          );
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;
