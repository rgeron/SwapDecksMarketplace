import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFlashcards } from "@/lib/api/decks";
import type { DeckWithProfile, FlashCard } from "@/types/marketplace";
import { useEffect, useState } from "react";
import { FlashcardPreview } from "./FlashcardPreview";
import { OverviewTab } from "./OverviewTab";

interface PurchasedDeckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  deck: DeckWithProfile;
  purchaseDate?: string;
}

export function PurchasedDeckDialog({
  isOpen,
  onClose,
  deck,
  purchaseDate,
}: PurchasedDeckDialogProps) {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [flashcards, setFlashcards] = useState<FlashCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadFlashcards = async () => {
      if (selectedTab === "flashcards" && deck.creatorid) {
        try {
          setIsLoading(true);
          const cards = await getFlashcards(deck.id, deck.creatorid);
          setFlashcards(cards);
        } catch (error) {
          console.error("Error loading flashcards:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadFlashcards();
  }, [selectedTab, deck.id, deck.creatorid]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{deck.title}</DialogTitle>
          <DialogDescription>
            Created by {deck.creatorName} • {deck.cardcount} cards
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="overview"
          className="w-full"
          value={selectedTab}
          onValueChange={setSelectedTab}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <OverviewTab deck={deck} purchaseDate={purchaseDate} />
          </TabsContent>

          <TabsContent value="flashcards" className="space-y-4">
            <FlashcardPreview
              flashcards={flashcards}
              isLoading={isLoading}
              limit={5}
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
