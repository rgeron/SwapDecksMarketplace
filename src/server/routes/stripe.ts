require("dotenv").config();

import express from "express";
import Stripe from "stripe";
import { purchaseDeck } from "../lib/api/decks";

const router = express.Router();

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

// Create a checkout session
router.post("/create-checkout-session", async (req, res) => {
  try {
    const { deckId, userId, deckTitle, price } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: deckTitle,
            },
            unit_amount: Math.round(price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/app/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/app/purchase-cancelled`,
      metadata: {
        deckId,
        userId,
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// Webhook handler
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"]!;

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      try {
        // Extract the deck and user IDs from the session metadata
        const { deckId, userId } = session.metadata!;

        // Update the purchase in your database
        await purchaseDeck(userId, deckId);

        console.log(
          `Successfully processed purchase for deck ${deckId} by user ${userId}`,
        );
      } catch (error) {
        console.error("Error processing purchase:", error);
        return res.status(500).send("Failed to process purchase");
      }
    }

    res.json({ received: true });
  },
);

export default router;
