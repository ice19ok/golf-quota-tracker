export type GolfCourse = {
  name: string;
  tee: string;
  pars: number[];
};

export const golfCourses: GolfCourse[] = [
  {
    name: "KickingBird Golf Club",
    tee: "White",
    pars: [
      4, 4, 3, 5, 4, 3, 4, 4, 4,
      4, 3, 5, 4, 3, 5, 3, 4, 4,
    ],
  },

  {
    name: "The Golf Club of Edmond",
    tee: "White",
    pars: [
      4, 5, 3, 4, 4, 4, 3, 4, 5,
      3, 4, 4, 4, 3, 4, 4, 3, 5,
    ],
  },
];

export function getGolfCourse(
  courseName: string
): GolfCourse | undefined {
  return golfCourses.find(
    (course) =>
      course.name === courseName
  );
}