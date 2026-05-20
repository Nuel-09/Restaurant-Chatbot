const MENU = [
  {
    idx: 10,
    name: "Margherita Pizza",
    description: "Classic cheese & tomato",
    price: 8000,
    options: [
      {
        id: "size",
        name: "Size",
        choices: [
          { id: "s", name: "Small", extra: 0 },
          { id: "m", name: "Medium", extra: 1500 },
          { id: "l", name: "Large", extra: 3000 },
        ],
      },
    ],
  },
  {
    idx: 11,
    name: "Pepperoni Pizza",
    description: "Pepperoni & cheese",
    price: 9000,
    options: [
      {
        id: "size",
        name: "Size",
        choices: [
          { id: "s", name: "Small", extra: 0 },
          { id: "m", name: "Medium", extra: 1500 },
          { id: "l", name: "Large", extra: 3000 },
        ],
      },
    ],
  },
  {
    idx: 12,
    name: "Chicken Burger",
    description: "Grilled chicken patty",
    price: 4000,
    options: [
      {
        id: "extras",
        name: "Extras",
        choices: [
          { id: "cheese", name: "Cheese", extra: 500 },
          { id: "bacon", name: "Bacon", extra: 800 },
        ],
      },
    ],
  },
  {
    idx: 13,
    name: "Fries",
    description: "Crispy fries",
    price: 1500,
    options: [],
  },
  {
    idx: 14,
    name: "Coke (500ml)",
    description: "Refreshing drink",
    price: 700,
    options: [],
  },
];

module.exports = { MENU };
