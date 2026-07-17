import { ActivityType, Prisma, PrismaClient, VoteType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type UserKey = "maya" | "theo" | "priya" | "jordan";
type WorkspaceKey = "kitchen" | "moveIn" | "cabin";
type ProductKey = "fellow" | "baratza" | "bambino" | "acaia" | "chemex" | "ember" | "lecreuset" | "allclad" | "sofa" | "lamp" | "tent" | "cooler";

type ProductSeed = {
  key: ProductKey;
  workspace: WorkspaceKey;
  title: string;
  imageUrl: string;
  productUrl: string;
  storeName: string;
  notes: string;
  addedBy: UserKey;
  prices: number[];
  votes: Partial<Record<UserKey, VoteType>>;
  comments: { user: UserKey; body: string; minutesAgo: number }[];
};

const productSeeds: ProductSeed[] = [
  {
    key: "fellow",
    workspace: "kitchen",
    title: "Fellow Stagg EKG Pro Kettle",
    imageUrl: "https://fellowproducts.com/cdn/shop/files/Web_PDP_StaggEKGElectricKettle-Pro_Woodland_Walnut_1.png?v=1773351258&width=2000",
    productUrl: "https://fellowproducts.com/products/stagg-ekg-pro-electric-kettle",
    storeName: "Fellow",
    notes: "The precise pour and scheduled boil are winning us over.",
    addedBy: "maya",
    prices: [199.95, 199.95, 194.95, 189.95, 189.95, 199.95, 179.95],
    votes: { maya: "love", theo: "favorite", priya: "love", jordan: "love" },
    comments: [
      { user: "priya", body: "This is the one I would be happy seeing on the counter every day.", minutesAgo: 302 },
      { user: "theo", body: "The scheduled boil is more useful than I expected. Sale price helps.", minutesAgo: 176 }
    ]
  },
  {
    key: "baratza",
    workspace: "kitchen",
    title: "Baratza Encore ESP Grinder",
    imageUrl: "https://assets.breville.com/cdn-cgi/image/format%3Dauto/ZCG495/ZCG495_Carousel1.png",
    productUrl: "https://www.baratza.com/en-us/product/encoretm-esp-zcg495",
    storeName: "Baratza",
    notes: "Easy enough for weekday drip, capable enough for espresso later.",
    addedBy: "theo",
    prices: [199.95, 199.95, 189.95, 199.95, 199.95, 199.95, 199.95],
    votes: { maya: "favorite", theo: "love", priya: "love" },
    comments: [
      { user: "maya", body: "Leaning here because replacement parts are actually available.", minutesAgo: 88 },
      { user: "jordan", body: "Looks less fussy than the other grinder we saved.", minutesAgo: 46 }
    ]
  },
  {
    key: "bambino",
    workspace: "kitchen",
    title: "Breville Bambino Plus",
    imageUrl: "https://breville-production-aem-assets.s3.us-west-2.amazonaws.com/BES500/BES500USCM_CAROUSEL1.png",
    productUrl: "https://www.breville.com/en-us/product/bes500",
    storeName: "Breville",
    notes: "Fast warm-up and genuinely compact, but this sets the budget ceiling.",
    addedBy: "priya",
    prices: [499.95, 499.95, 529.95, 529.95, 499.95, 529.95, 499.95],
    votes: { maya: "love", theo: "pass", priya: "pass", jordan: "love" },
    comments: [
      { user: "theo", body: "I like it, but grinder plus machine puts us well over the original plan.", minutesAgo: 16 },
      { user: "maya", body: "Could wait for the next holiday sale instead of forcing this now.", minutesAgo: 10 }
    ]
  },
  {
    key: "acaia",
    workspace: "kitchen",
    title: "Acaia Pearl Coffee Scale",
    imageUrl: "https://acaia.co/cdn/shop/files/PearlS_black_1.jpg?v=1768987825&width=1500",
    productUrl: "https://acaia.co/products/pearl-model-s",
    storeName: "Acaia",
    notes: "Beautiful and quick, though the price is hard to defend for a scale.",
    addedBy: "maya",
    prices: [220, 220, 220, 215, 220, 220, 220],
    votes: { maya: "pass", theo: "favorite", priya: "pass" },
    comments: [
      { user: "priya", body: "This is where I vote for the sensible option instead.", minutesAgo: 57 },
      { user: "theo", body: "Fair. I mostly saved it because the timer display is excellent.", minutesAgo: 49 }
    ]
  },
  {
    key: "chemex",
    workspace: "kitchen",
    title: "Chemex Six Cup Classic",
    imageUrl: "https://chemexcoffeemaker.com/cdn/shop/files/cm-6a.jpg?v=1724186506&width=1080",
    productUrl: "https://chemexcoffeemaker.com/collections/classic-series/products/six-cup-classic-chemex",
    storeName: "Chemex",
    notes: "The low-cost option that also works when everyone is over.",
    addedBy: "jordan",
    prices: [54.5, 54.5, 49.5, 49.5, 54.5, 49.5, 49.5],
    votes: { maya: "favorite", theo: "love", priya: "love", jordan: "favorite" },
    comments: [
      { user: "jordan", body: "We already know how to use it and it makes enough for four people.", minutesAgo: 210 }
    ]
  },
  {
    key: "ember",
    workspace: "kitchen",
    title: "Ember Mug 2",
    imageUrl: "https://scdn.speedsize.com/c2fd7a9b-205f-4207-98ab-77d0b1777975/ember.com/cdn/shop/files/ember_CM1910_00-black_5000x.jpg?v=1762439501",
    productUrl: "https://ember.com/products/ember-mug-2",
    storeName: "Ember",
    notes: "Useful for long calls, but probably a personal buy rather than shared gear.",
    addedBy: "theo",
    prices: [149.95, 129.95, 129.95, 139.95, 129.95, 129.95, 129.95],
    votes: { maya: "pass", theo: "pass", priya: "favorite" },
    comments: [
      { user: "maya", body: "Fun, but it does not solve a group need. I would cut this one.", minutesAgo: 73 }
    ]
  },
  {
    key: "lecreuset",
    workspace: "kitchen",
    title: "Le Creuset Signature Dutch Oven",
    imageUrl: "https://www.lecreuset.com/dw/image/v2/BDRT_PRD/on/demandware.static/-/Sites-le-creuset-master/default/dw9e4ffb1b/images/cat_dutch_ovens/provence/provene_rdo_g1.jpg?sh=650&sm=fit&sw=650",
    productUrl: "https://www.lecreuset.com/round-dutch-oven/21177US.html",
    storeName: "Le Creuset",
    notes: "The forever option, sized for the batches we actually cook.",
    addedBy: "priya",
    prices: [419.95, 419.95, 389.95, 419.95, 399.95, 399.95, 379.95],
    votes: { maya: "love", theo: "favorite", priya: "love", jordan: "pass" },
    comments: [{ user: "maya", body: "I would rather buy this once than replace another cheap pot.", minutesAgo: 440 }]
  },
  {
    key: "allclad",
    workspace: "kitchen",
    title: "All-Clad D3 Stainless Fry Pan",
    imageUrl: "https://www.all-clad.com/media/catalog/product/8/7/8701004401_hero.jpg?optimize=high&bg-color=255,255,255&fit=bounds&height=800&width=800&canvas=800:800",
    productUrl: "https://www.all-clad.com/d3-stainless-3-ply-bonded-cookware-fry-pan-12-inch.html",
    storeName: "All-Clad",
    notes: "A practical daily pan with no coating to baby.",
    addedBy: "maya",
    prices: [159.99, 159.99, 149.99, 149.99, 159.99, 159.99, 159.99],
    votes: { maya: "favorite", theo: "love", priya: "love" },
    comments: [{ user: "theo", body: "Twelve inches is the right size. I checked the cabinet depth.", minutesAgo: 380 }]
  },
  {
    key: "sofa",
    workspace: "moveIn",
    title: "Article Sven 88-inch Sofa",
    imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=85",
    productUrl: "https://www.article.com/product/22670/sven-briar-gray-sofa",
    storeName: "Article",
    notes: "Deep enough for movie nights without swallowing the whole room.",
    addedBy: "theo",
    prices: [1699, 1699, 1599, 1699, 1649, 1599, 1599],
    votes: { maya: "love", theo: "favorite", priya: "love", jordan: "pass" },
    comments: [{ user: "priya", body: "Gray keeps the rug options open. The dimensions work on the taped outline.", minutesAgo: 90 }]
  },
  {
    key: "lamp",
    workspace: "moveIn",
    title: "HAY Matin Table Lamp",
    imageUrl: "https://www.hay.com/img_20250422110919/img_20250422110919/globalassets/inriver/integration/service/matin-table-lamp_910x1100_brandmodel2.jpg",
    productUrl: "https://www.hay.com/hay/lighting/table-lamp/matin-table-lamp",
    storeName: "HAY",
    notes: "Soft enough for evenings, with a shape that breaks up the straight lines.",
    addedBy: "maya",
    prices: [235, 235, 219, 219, 235, 219, 219],
    votes: { maya: "favorite", theo: "love", priya: "pass" },
    comments: [{ user: "theo", body: "I like the light, less convinced by the pleated shade dust situation.", minutesAgo: 120 }]
  },
  {
    key: "tent",
    workspace: "cabin",
    title: "Snow Peak Alpha Breeze Tent",
    imageUrl: "https://www.snowpeak.com/cdn/shop/files/SD-480P-IV-US_20200917-5DS_0120_jpg.jpg?v=1758221200&width=1600",
    productUrl: "https://www.snowpeak.com/products/alpha-breeze",
    storeName: "Snow Peak",
    notes: "Room for four adults and an awning that works in bad weather.",
    addedBy: "jordan",
    prices: [599.95, 599.95, 549.95, 599.95, 549.95, 549.95, 549.95],
    votes: { maya: "love", theo: "love", jordan: "favorite" },
    comments: [{ user: "maya", body: "This wins if setup is genuinely under ten minutes.", minutesAgo: 260 }]
  },
  {
    key: "cooler",
    workspace: "cabin",
    title: "YETI Roadie 24 Cooler",
    imageUrl: "https://yeti-webmedia.imgix.net/asset/8af22502-e5e7-4a8c-bf5d-d30ed51fea17/W/240149_PDP_Roadie_2-0_Product_Overview_P1_Desktop-2x.png?auto=format%2Ccompress&fit=crop&h=400&w=400",
    productUrl: "https://www.yeti.com/coolers/hard-coolers/roadie/roadie-24.html",
    storeName: "YETI",
    notes: "Fits behind the driver seat and holds enough for the first two days.",
    addedBy: "theo",
    prices: [250, 250, 225, 225, 250, 250, 250],
    votes: { maya: "favorite", theo: "love", jordan: "love" },
    comments: [{ user: "jordan", body: "Borrowing one is still my first choice, buying this is plan B.", minutesAgo: 180 }]
  }
];

async function main() {
  await prisma.activityEvent.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.product.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("cartparty123", 12);
  const maya = await prisma.user.create({ data: { email: "maya@cartparty.dev", name: "Maya Chen", passwordHash } });
  const theo = await prisma.user.create({ data: { email: "theo@cartparty.dev", name: "Theo Brooks", passwordHash } });
  const priya = await prisma.user.create({ data: { email: "priya@cartparty.dev", name: "Priya Shah", passwordHash } });
  const jordan = await prisma.user.create({ data: { email: "jordan@cartparty.dev", name: "Jordan Lee", passwordHash } });
  const users = { maya, theo, priya, jordan };

  const moveIn = await prisma.workspace.create({
    data: {
      name: "Move In",
      ownerId: theo.id,
      createdAt: daysAgo(2),
      members: { create: [
        { userId: theo.id, role: "owner" },
        { userId: maya.id, role: "member" },
        { userId: priya.id, role: "member" },
        { userId: jordan.id, role: "member" }
      ] }
    }
  });
  const cabinTrip = await prisma.workspace.create({
    data: {
      name: "Cabin Trip",
      ownerId: jordan.id,
      createdAt: daysAgo(1),
      members: { create: [
        { userId: jordan.id, role: "owner" },
        { userId: maya.id, role: "member" },
        { userId: theo.id, role: "member" }
      ] }
    }
  });
  const kitchenReset = await prisma.workspace.create({
    data: {
      name: "Kitchen Reset",
      ownerId: maya.id,
      members: { create: [
        { userId: maya.id, role: "owner" },
        { userId: theo.id, role: "member" },
        { userId: priya.id, role: "member" },
        { userId: jordan.id, role: "member" }
      ] }
    }
  });

  const workspaces = { kitchen: kitchenReset, moveIn, cabin: cabinTrip };
  const seededProducts = new Map<ProductKey, Awaited<ReturnType<typeof prisma.product.create>>>();

  for (const [index, item] of productSeeds.entries()) {
    const currentPrice = item.prices[item.prices.length - 1]!;
    const product = await prisma.product.create({
      data: {
        workspaceId: workspaces[item.workspace].id,
        title: item.title,
        imageUrl: item.imageUrl,
        productUrl: item.productUrl,
        storeName: item.storeName,
        currentPrice: new Prisma.Decimal(currentPrice),
        notes: item.notes,
        addedBy: users[item.addedBy].id,
        createdAt: minutesAgo(index * 4 + 3)
      }
    });
    seededProducts.set(item.key, product);

    const votes = Object.entries(item.votes).map(([user, voteType]) => ({
      productId: product.id,
      userId: users[user as UserKey].id,
      voteType
    }));
    await prisma.vote.createMany({ data: votes });

    for (const comment of item.comments) {
      await prisma.comment.create({
        data: { productId: product.id, userId: users[comment.user].id, body: comment.body, createdAt: minutesAgo(comment.minutesAgo) }
      });
    }

    const historyDays = [21, 17, 14, 10, 7, 3, 0];
    for (const [priceIndex, price] of item.prices.entries()) {
      await prisma.priceHistory.create({
        data: {
          productId: product.id,
          price: new Prisma.Decimal(price),
          recordedAt: daysAgo(historyDays[priceIndex]!, priceIndex === item.prices.length - 1 ? 60 : 0)
        }
      });
    }
  }

  const activeEvents: { product: ProductKey; actor: UserKey; type: ActivityType; minutes: number; metadata?: Record<string, string | number> }[] = [
    { product: "fellow", actor: "maya", type: "price_dropped", minutes: 3, metadata: { from: 199.95, to: 179.95 } },
    { product: "chemex", actor: "priya", type: "vote_cast", minutes: 8, metadata: { voteType: "love" } },
    { product: "bambino", actor: "theo", type: "comment_added", minutes: 15 },
    { product: "baratza", actor: "maya", type: "vote_cast", minutes: 24, metadata: { voteType: "favorite" } },
    { product: "ember", actor: "theo", type: "product_added", minutes: 38 },
    { product: "acaia", actor: "priya", type: "comment_added", minutes: 55 },
    { product: "ember", actor: "maya", type: "vote_cast", minutes: 72, metadata: { voteType: "pass" } },
    { product: "bambino", actor: "priya", type: "price_dropped", minutes: 100, metadata: { from: 529.95, to: 499.95 } },
    { product: "fellow", actor: "jordan", type: "vote_cast", minutes: 140, metadata: { voteType: "love" } },
    { product: "chemex", actor: "jordan", type: "product_added", minutes: 220 },
    { product: "fellow", actor: "priya", type: "comment_added", minutes: 300 },
    { product: "acaia", actor: "maya", type: "product_added", minutes: 500 },
    { product: "bambino", actor: "priya", type: "product_added", minutes: 800 },
    { product: "baratza", actor: "theo", type: "product_added", minutes: 1100 }
  ];

  for (const event of activeEvents) {
    await createActivity(kitchenReset.id, event.actor, event.product, event.type, event.minutes, event.metadata);
  }

  const workspaceEvents: { workspaceId: string; product: ProductKey; actor: UserKey; type: ActivityType; minutes: number; metadata?: Record<string, string | number> }[] = [
    { workspaceId: moveIn.id, product: "sofa" as ProductKey, actor: "priya" as UserKey, type: "comment_added" as ActivityType, minutes: 18 },
    { workspaceId: moveIn.id, product: "lamp" as ProductKey, actor: "maya" as UserKey, type: "vote_cast" as ActivityType, minutes: 52, metadata: { voteType: "favorite" } },
    { workspaceId: moveIn.id, product: "sofa" as ProductKey, actor: "theo" as UserKey, type: "product_added" as ActivityType, minutes: 190 },
    { workspaceId: cabinTrip.id, product: "tent" as ProductKey, actor: "maya" as UserKey, type: "vote_cast" as ActivityType, minutes: 14, metadata: { voteType: "love" } },
    { workspaceId: cabinTrip.id, product: "cooler" as ProductKey, actor: "jordan" as UserKey, type: "comment_added" as ActivityType, minutes: 68 },
    { workspaceId: cabinTrip.id, product: "tent" as ProductKey, actor: "jordan" as UserKey, type: "price_dropped" as ActivityType, minutes: 240, metadata: { from: 599.95, to: 549.95 } }
  ];
  for (const event of workspaceEvents) {
    await createActivity(event.workspaceId, event.actor, event.product, event.type, event.minutes, event.metadata);
  }

  async function createActivity(workspaceId: string, actor: UserKey, productKey: ProductKey, eventType: ActivityType, minutes: number, extra: Record<string, string | number> = {}) {
    const product = seededProducts.get(productKey)!;
    await prisma.activityEvent.create({
      data: {
        workspaceId,
        actorId: users[actor].id,
        eventType,
        metadata: { productId: product.id, title: product.title, ...extra },
        createdAt: minutesAgo(minutes)
      }
    });
  }

  const [workspaceCount, productCount, activityCount] = await Promise.all([
    prisma.workspace.count(),
    prisma.product.count(),
    prisma.activityEvent.count()
  ]);
  console.log(`Seeded ${workspaceCount} workspaces, ${productCount} products, and ${activityCount} activity events`);
  console.log("Login: maya@cartparty.dev / cartparty123");
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function daysAgo(days: number, extraMinutes = 0) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000 - extraMinutes * 60 * 1000);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
