import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { getFlashcards, getUserBalance, purchaseDeck } from "@/lib/api/decks";
import { useAuth } from "@/lib/auth";
import type { BuyDeckDialogProps, FlashCard } from "@/types/marketplace";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { FlashcardPreview } from "./FlashcardPreview";
import { OverviewTab } from "./OverviewTab";

export const BuyDeckDialog = ({
  isOpen,
  onClose,
  deck,
}: BuyDeckDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("overview");
  const [flashcards, setFlashcards] = useState<FlashCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [userBalance, setUserBalance] = useState<number>(0);

  useEffect(() => {
    const loadFlashcards = async () => {
      if (selectedTab === "preview" && deck.creatorid) {
        try {
          setIsLoading(true);
          const cards = await getFlashcards(deck.id, deck.creatorid);
          setFlashcards(cards);
        } catch (error) {
          console.error("Error loading flashcards:", error);
          toast({
            title: "Error",
            description: "Failed to load flashcards preview",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      }
    };

    if (isOpen && selectedTab === "preview") {
      loadFlashcards();
    }
  }, [isOpen, selectedTab, deck.id, deck.creatorid, toast]);

  // Load user balance when dialog opens
  useEffect(() => {
    const loadUserBalance = async () => {
      if (user) {
        try {
          const balance = await getUserBalance(user.id);
          setUserBalance(balance);
        } catch (error) {
          console.error("Error loading user balance:", error);
        }
      }
    };

    if (isOpen) {
      loadUserBalance();
    }
  }, [isOpen, user]);

  const handlePurchase = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to purchase this deck",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsPurchasing(true);

      // Validate price
      if (!deck.price || deck.price <= 0) {
        throw new Error("Invalid price");
      }

      // Check if user has enough balance
      if (userBalance < deck.price) {
        toast({
          title: "Insufficient balance",
          description: `You need $${(deck.price - userBalance).toFixed(2)} more to purchase this deck. Please refill your balance.`,
          variant: "destructive",
        });
        return;
      }

      // Process the purchase
      await purchaseDeck(user.id, deck.id, deck.price);

      toast({
        title: "Purchase successful",
        description: "The deck has been added to your library",
      });

      // Update local balance
      setUserBalance((prev) => prev - deck.price);

      onClose();
    } catch (error) {
      console.error("Purchase error:", error);
      toast({
        title: "Purchase failed",
        description: "There was an error processing your purchase",
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl min-h-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">{deck.title}</DialogTitle>
          <DialogDescription className="text-base">
            Created by {deck.creatorName} • {deck.cardcount} cards
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="overview"
          className="flex-1 flex flex-col overflow-hidden"
          value={selectedTab}
          onValueChange={setSelectedTab}
        >
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="preview">Preview Cards</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto py-4">
            <TabsContent
              value="overview"
              className="mt-0 h-full"
              forceMount={selectedTab === "overview"}
            >
              <OverviewTab deck={deck} />
            </TabsContent>

            <TabsContent
              value="preview"
              className="mt-0 h-full"
              forceMount={selectedTab === "preview"}
            >
              <FlashcardPreview
                flashcards={flashcards}
                isLoading={isLoading}
                limit={5}
              />
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-between items-center space-x-4 pt-4 border-t">
          <div className="text-sm text-gray-500">
            Your balance: ${userBalance.toFixed(2)}
          </div>
          <div className="flex space-x-4">
            <Button variant="outline" onClick={onClose} disabled={isPurchasing}>
              Cancel
            </Button>
            <Button
              onClick={handlePurchase}
              className="bg-[#2B4C7E] text-white hover:bg-[#1A365D]"
              disabled={isPurchasing}
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Purchase for $${deck.price.toFixed(2)}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
