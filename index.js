(function () {
  const SOS = [
    "An ability to identify, formulate, and solve complex engineering problems by applying principles of engineering, science, and mathematics",
    "An ability to apply engineering design to produce solutions that meet specified needs, with consideration of public health, safety, welfare, and global, cultural, social, environmental, and economic factors",
    "An ability to communicate effectively with a range of audiences",
    "An ability to recognize ethical and professional responsibilities in engineering situations and make informed judgments, considering the impact of engineering solutions in global, economic, environmental, and societal contexts",
    "An ability to function effectively on a team that provides leadership, creates a collaborative and inclusive environment, establishes goals, plans tasks, and meets objectives",
    "An ability to develop and conduct appropriate experimentation, analyze and interpret data, and use engineering judgment to draw conclusions",
    "An ability to acquire and apply new knowledge as needed, using appropriate learning strategies",
  ];
  const THRESHOLD = 60;
  // Chained division/multiplication can land a hair below an exact threshold
  // (e.g. 59.999999999999986 instead of 60) purely from floating-point noise.
  // Excel's own COUNTIF rounds comparisons to ~15 significant digits before
  // testing, so we round too rather than let that noise flip a pass to a fail.
  function meetsThreshold(v) {
    return Math.round(v * 1e6) / 1e6 >= THRESHOLD;
  }
  const STORE_PREFIX = "cat:";
  const CONFIG_KEY = "config:lists";
  const PROGRAMS = [
    "Mechanical Engineering",
    "Mechatronics Engineering",
    "Energy Systems Engineering",
  ];

  // Uses Claude's shared artifact storage when this runs inside claude.ai (so a team
  // sees the same saved records). If opened as a standalone file — e.g. emailed to a
  // colleague and opened directly in a browser — window.storage doesn't exist there,
  // so this falls back to that browser's own localStorage instead of breaking.
  const USING_CLOUD_STORAGE = !!(
    window.storage && typeof window.storage.get === "function"
  );
  const storageBackend = USING_CLOUD_STORAGE
    ? window.storage
    : {
        async get(key) {
          const v = localStorage.getItem("dcat:" + key);
          if (v === null) throw new Error("not found");
          return { key, value: v };
        },
        async set(key, value) {
          localStorage.setItem("dcat:" + key, value);
          return { key, value };
        },
        async delete(key) {
          localStorage.removeItem("dcat:" + key);
          return { key, deleted: true };
        },
        async list(prefix) {
          const keys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.indexOf("dcat:") === 0) {
              const bare = k.slice(5);
              if (!prefix || bare.indexOf(prefix) === 0) keys.push(bare);
            }
          }
          return { keys };
        },
      };

  function slug(s) {
    return (s || "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9\-_.]/g, "");
  }
  function storeKey(m) {
    return (
      STORE_PREFIX +
      slug(m.program) +
      ":" +
      slug(m.course) +
      ":" +
      slug(m.semester)
    );
  }
  function uid() {
    return "i" + Math.random().toString(36).slice(2, 9);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  function generateSemesters(startYear, numYears) {
    const list = [];
    for (let y = startYear; y < startYear + numYears; y++) {
      list.push("Fall " + y + "-" + (y + 1));
      list.push("Spring " + y + "-" + (y + 1));
    }
    return list;
  }
  function nextSemester(label) {
    const m = (label || "").match(/(Fall|Spring) (\d{4})-(\d{4})/);
    if (!m) return null;
    const season = m[1],
      y1 = +m[2],
      y2 = +m[3];
    return season === "Fall"
      ? "Spring " + y1 + "-" + y2
      : "Fall " + y2 + "-" + (y2 + 1);
  }

  function defaultConfig() {
    return {
      coursesByProgram: {
        "Mechanical Engineering": [
          "MENG246 Thermodynamics II",
          "MENG345 Heat Transfer",
          "MENG443 HVAC",
          "MENG442 Solar Engineering",
          "MENG286 Materials Science",
          "MENG364 Manufacturing Technology",
          "MENG424 Reliability Engineering",
          "MENG233 Dynamics",
          "MENG331 Mechanical Vibrations",
          "MENG421 Finite Element Analysis",
          "MECT361 Mechatronics Components & Instrumentation",
          "MECT444 Industrial Automation",
          "MENG190 Intro to Mechanical Engineering",
          "IENG355 Engineering Ethics",
          "MENG400 Summer Practice",
          "MENG303 Computer Aided engineering Design",
          "MENG410 Introduction to Capstone Design",
          "MENG411 Capstone Team Project",
        ],
        "Mechatronics Engineering": [
          "MENG364 Manufacturing Technology",
          "MENG331 Mechanical Vibrations",
          "MECT361 Mechatronics Components & Instrumentation",
          "MECT444 Industrial Automation",
          "MENG424 Reliability Engineering",
          "INFE242 Electronics",
          "EENG312 Microcontroller Applications",
          "EENG428 Introduction to Robotics",
          "EENG112 Introduction to Programming",
          "CMPE428 Data Science",
          "CMPE461 Artificial Intelligence",
          "CMPE423 Embedded System Design",
          "MECT190 Intro to Mechatronics Engineering",
          "IENG355 Engineering Ethics",
          "MECT400 Industrial Training",
          "MENG303 Computer Aided engineering Design",
          "MECT410 Introduction to Capstone Design",
          "MECT411 Capstone Team Project",
        ],
        "Energy Systems Engineering": [
          "MENG246 Thermodynamics II",
          "MENG345 Heat Transfer",
          "MENG443 HVAC",
          "MENG442 Solar Engineering",
          "INFE242 Electronics",
          "MENG421 Finite Element Analysis",
          "MENG424 Reliability Engineering",
          "MECT444 Industrial Automation",
          "EENG459 Renewable Energy Systems",
          "MENG331 Mechanical Vibrations",
          "MENG446 Thermal Power Engines",
          "MENG449 Introduction to Energy Management",
          "ENRG190 Intro to Energy Systems Engineering",
          "IENG355 Engineering Ethics",
          "ENRG400 Industrial Training",
          "MENG303 Computer Aided engineering Design",
          "ENRG410 Introduction to Capstone Design",
          "ENRG411 Capstone Team Project",
        ],
      },
      semesters: generateSemesters(2025, 6),
      closByCourse: {
        "MENG246 Thermodynamics II": [
          "Understand the operating principles of gas powered cycles and analyze their thermodynamic performance.",
          "Understand the operating principles of vapour cycles and analyze their thermodynamic performance.",
          "Understand the operating principles of refrigeration cycles and analyze their thermodynamic performance.",
          "Analyze the properties and p-v-t behavior of gas mixtures.",
          "Perform thermodynamic analysis on different processes by using thermodynamic relations and psychrometric diagram.",
          "Understand the properties of different fuels and write thermodynamic equations to evaluate enthalpy of combustion reactions.",
          "Analyze the thermodynamic performance of wet cooling tower experimentally",
          "Analyze the thermodynamic performance of an HVAC process experimentally",
        ],
        "MENG345 Heat Transfer": [
          "Understand the basic mechanisms of heat transfer.",
          "Be able to obtain and solve DE of heat conduction.",
          "Comprehend steady conduction, solve steady conduction problems by resistance concept and analyze fins.",
          "Be able to solve transient heat transfer problems for lumped systems & systems with spatial effects.",
          "Understand the numerical solution of steady, 1D & 2D and transient, 1D & 2D heat conduction problems.",
          "Evaluate convection coefficient, heat transfer and associated temperatures for external flow.",
          "Calculate convection coefficient, heat transfer and associated temperatures for internal flow.",
          "Evaluate convection coefficient and heat transfer for free convection cases.",
          "Analyze & size HEXs by LMTD and ε-NTU method.",
        ],
        "MENG443 HVAC": [
          "Acquire a knowledge of thermal environment, comfort and indoor design criteria.",
          "Understand the climatic design and external design conditions.",
          "Be able to understand and evaluate thermal transmittance, building heat losses and design heating load.",
          "Acquire a knowledge about heating systems and understand their working principles.",
          "Learn how to design a hydronic heating system and its components e.g. heat generator selection, pipe and pump sizing etc.",
          "Understand various parameters associated with cooling load and be able to estimate cooling load of buildings by steady cyclic method.",
          "Comprehend the importance of ventilation, distinguish different ventilation systems and be able to carry out simple duct calculations and sizing.",
          "Learn the methods for air conditioning, comprehend the psychrometric chart and be able to analyze typical air conditioning processes by using psychrometric chart.",
        ],
        "MENG442 Solar Engineering": [
          "Understand the characteristics of solar energy, sun-earth geometric relations and sun path/shade diagrams.",
          "Comprehend beam & diffuse rad., and estimation of terrestrial rad. intercepted & absorbed by surfaces.",
          "Have a fundamental knowledge regarding the heat transfer aspects of the solar thermal design.",
          "Be able to analyze flat plate & concentrating solar thermal collectors.",
          "Develop an understanding of thermal energy storage with emphasis placed on water.",
          "Analyze solar thermal energy component models such as collector heat exchangers and array of collectors.",
          "Understand and use f-chart design methods for designing typical liquid based solar heating systems.",
          "Get familiar with basics of PVs & calculate electrical capacity of a PVT system from various measurements.",
          "Be able to design and analyze various solar systems by employing contemporary simulation tools.",
        ],
        "MENG286 Materials Science": [
          "Classify the solid materials, learning and understanding the atomic bonding in solids. Calculate the density of a material from the knowledge of the crystal structure understanding and drawing the cubic crystal structures, Unit cell, Face-centred cubic, body-centre cubic .Understanding and calculating the Miller indices of a crystallographic planes",
          "Understanding and describing the imperfections and dislocations in the solids and calculating the grain size of a crystalline material.",
          "Understanding the diffusion mechanisms and using the Fick’s Laws to make calculations for the diffusion problems.",
          "Understanding the mechanical properties of materials, the Hooke’s law, the stress and strain relations, Poisson’s ratio, ductility, hardness methods and conducting an experiment assign.",
          "Understanding the phase diagrams for alloy systems, learning to make a correlation between microstructure and mechanical properties by carefully control of the heat treatment processes.",
          "Understanding the importance of a heat treatment, and the effects on the microstructure of the iron-carbon alloys. To design a heat treatment process that will produce the desired microstructure.",
          "Knowing the types of ferrous and nonferrous metals, and the applications area.",
          "Understanding of the mechanisms and causes of corrosion and degradation of metals, learning the methods",
          "1",
          "3",
        ],
        "MENG364 Manufacturing Technology": [
          "an ability to identify, formulate, and solve complex engineering problems by applying principles of engineering, science, andmathematics",
          "an ability to apply engineering design to produce solutions that meet specified needs with consideration of public health, safety,and welfare, as well as global, cultural, social, environmental, and economic factors",
          "an ability to communicate effectively with a range of audiences",
          "an ability to recognize ethical and professional responsibilities in engineering situations and make informed judgments, whichmust consider the impact of engineering solutions in global, economic, environmental, and societal contexts",
          "an ability to function effectively on a team whose members together provide leadership, create a collaborative and inclusiveenvironment, establish goals, plan tasks, and meet objectives",
          "an ability to develop and conduct appropriate experimentation, analyze and interpret data, and use engineering judgment todraw conclusions",
          "an ability to acquire and apply new knowledge as needed, using appropriate learning strategies.",
          "Classification of manufacturing",
          "Casting technology",
          "Metal forming and sheet metal working",
          "Materials removal and machining processes",
          "Non-traditional machining processes",
          "Fundamental of Welding Technology",
          "Processing of polymers",
          "Introduction to CNC technology and G Codes",
          "Particulate processing of metals and ceramics",
          "Glass working",
        ],
        "MENG424 Reliability Engineering": [
          "Understand the fundamental concepts of reliability engineering",
          "Compute measures of reliability of products and systems",
          "Construct and analyze Reliability Block Diagrams",
          "Conduct Fault Tree Analysis",
          "Perform Failure Modes and Effects Analysis",
          "Probable causes and types of failure",
          "Recognition of the relevant standards, codes and regulations",
          "Use the techniques and tools learned to solve practical engineering problems. Design for Reliability",
        ],
        "MENG233 Dynamics": [
          "Analyze the kinematics of particles",
          "Analyze the kinetics of particles using: (force and acceleration, principle of work and energy, or principle of impulse and momentum)",
          "Analyze the planar kinematics of rigid bodies (Relative motion analysis: velocity and acceleration)",
          "Analyze the planar kinetics of rigid bodies using: (force and acceleration, principle of work and energy, or principle of impulse and momentum)",
          "Use the techniques learned to model and analyze a dynamic system.",
        ],
        "MENG331 Mechanical Vibrations": [
          "Modelling and analysis of dynamic systems as discretized lumped parameter systems",
          "Perform Vibration analysis of Single DOF systems",
          "Understand Harmonically excited vibration",
          "Perform Vibration analysis of Multi DOF systems",
          "Perform Vibration analysis of damped systems",
          "Determine Natural Frequencies and Mode Shapes",
          "Understand Vibration control techniques",
          "Understand Balancing of machinery",
        ],
        "MENG421 Finite Element Analysis": [
          "Develop stiffness matrices for 1D, 2D and 3D problems",
          "Use appropriate 1D (truss and beam), 2D (triangle and quadrilateral continuum and shell elements) and 3D (tetrahedral and brick elements) elements for a given problem",
          "Use finite element analysis software to mesh a solid model",
          "Apply loads and boundary conditions",
          "Complete an FEA analysis, interpret the results, and recognize sources of errors in FEA",
          "Design and Analyze engineering structures using finite element methods",
        ],
        "MECT361 Mechatronics Components & Instrumentation": [
          "Knowledge of key concepts of elements of mechatronics",
          "Understand the concept of data acquisition",
          "Learn of sensors theory, design, and application.",
          "Getting knowledge about actuators theory, design, and application.",
          "Evaluation of sensors and actuators used in the measurement of various applications",
        ],
        "MECT444 Industrial Automation": [
          "Understand the fundamentals and principle of operation for programmable logic controllers.",
          "Understand the hardware construction and components for programmable logic controllers.",
          "PLC Program using ladder logic programming.",
          "Understand various timers, counters, fault and interrupt systems.",
          "Gain proficiency with a PLC simulation software package, and utilize this software package to design and solve problems.",
        ],
        "MENG190 Intro to Mechanical Engineering": [
          "Understand the fundamentals of Mechanical Engineering.",
          "Understand the use of units/dimensions and unit conversion in engineering calculations",
          "Understand basic principles of scientific computation and engineering solutions i.e. Problem Identification, Problem Formulation and Problem Solution.",
          "Understand collection and presentation of engineering data",
          "Understand the Ethical issues and Professional Responsibilities in Engineering.",
          "Understand the fundamentals of Occupational Health and Safety, and safety practices at departmental laboratories and university campus.",
        ],
        "IENG355 Engineering Ethics": [
          "Fundamental concepts of engineering ethics",
          "Engineering code of ethics,",
          "The use of techniques to analyse cases",
          "The importance of international professionalism",
          "Recognizing and defining ethical problems",
          "Using different techniques for case analysis",
          "Applying the suitable technique when analysing an ethical situation",
          "Making use of the code of ethics during case analysis",
          "Making ethically optimal decisions",
          "The role of ethics in the engineering profession",
          "Responsible professional conduct",
        ],
        "MENG400 Summer Practice": [
          "Understand the Organizational Structure of a company.",
          "Develop work habits and attitudes necessary for job success (technical competence, professional attitude, organization skills etc.)",
          "Develop written communication and technical report writing skills.",
          "Develop knowledge of contemporary issues.",
          "Develop an awareness for the need and applications of standards in the industry.",
        ],
        "MENG303 Computer Aided engineering Design": [
          "Modeling and analysis of mechanical parts and assemblies in CAD software",
          "Understand the fundamentals of mechanical design",
          "Define design objectives, design constraints and product specifications.",
          "Collect and review related data such as technical information, regulations, and standards etc. from credible literature resources to generate solutions.",
          "Manage concept generation, evaluation & selection.",
          "Develop an effective design strategy and project plan",
          "Design a system to meet the design criteria and constraints (such as cost, economic, resource availability, environment, sustainability, safety, manufacturability, assembly, reliability, testing and maintenance, and product life cycle considerations).",
          "Develop detailed manufacturing/ simulation plan",
          "Develop a testing plan for verification and validation",
          "Understand the significance of relevant engineering standards for materials, components, manufacturing and product qualification",
          "Understand the major characteristics of engineering drawings according to the technical drawing standards",
          "Manage design documentation",
        ],
        "MENG410 Introduction to Capstone Design": [
          "Define design objectives, design constraints and product specifications according to the stakeholder and project requirements.",
          "Collect and review related data such as technical information, regulations, and standards etc. from credible literature resources, published research, and patents etc. to generate solutions.",
          "Manage concept generation and concept evaluation process, analyze and compare design alternatives/possible solutions, at the system and subsystem levels, and use measures of performance or other criteria to rank alternatives",
          "Develop an effective design strategy and project plan (work breakdown structure) explaining major milestones of the project with their respective timelines, responsibilities and resource allocation (Cost) to ensure timely and within-budget completion of the project.",
          "Design a system to meet the design criteria and constraints (such as cost, economic, resource availability, environment, sustainability, safety, manufacturability, assembly, reliability, testing and maintenance, and product life cycle considerations).",
          "Develop detailed manufacturing/ simulation/ implementation plan by selecting the suitable manufacturing/ simulation/ implementation techniques.",
          "Develop the plan for verification and validation of the project objectives according to the relevant engineering standards/ requirements/ design criteria.",
          "Understand the significance of relevant engineering standards for materials, components, manufacturing and product qualification",
          "Understand the major characteristics of engineering drawings and generate engineering drawings according to the technical drawing standards (layout, assembly drawing, parts drawings, etc.)",
          "Manage design documentation and communication (both orally and in writing) using language and graphics appropriate to the technical discipline, with the necessary supporting material, to achieve desired understanding and impact.",
        ],
        "MENG411 Capstone Team Project": [
          "Define design objectives, design constraints and product specifications according to the stakeholder and project requirements.",
          "Collect and review related data such as technical information, regulations, and standards etc. from credible literature resources, published research, and patents etc. to generate solutions.",
          "Manage concept generation and concept evaluation process, analyze and compare design alternatives/possible solutions, at the system and subsystem levels, and use measures of performance or other criteria to rank alternatives",
          "Execute the design strategy and project plan (work breakdown structure) to ensure timely and within-budget completion of the project.",
          "Design a system to meet the design criteria and constraints (such as cost, economic, resource availability, environment, sustainability, safety, manufacturability, assembly, reliability, testing and maintenance, and product life cycle considerations)",
          "Execute manufacturing/ simulation/ implementation plan by selecting the suitable manufacturing/ simulation/ implementation techniques.",
          "Verification and validation of the project objectives according to the relevant engineering standards/ requirements/ design criteria.",
          "Understand the significance of relevant engineering standards for materials, components, manufacturing and product qualification.",
          "Understand the major characteristics of engineering drawings and generate engineering drawings according to the technical drawing standards (layout, assembly drawing, parts drawings, etc.)",
          "Manage design documentation and communication (both orally and in writing) using language and graphics appropriate to the technical discipline, with the necessary supporting material, to achieve desired understanding and impact.",
        ],
        "INFE242 Electronics": [
          "Amplification and types of amplifiers",
          "Semiconductors",
          "Diode circuits",
          "Transistors (MOSFETS, BJTS)",
          "Basic Amplifiers",
        ],
        "EENG428 Introduction to Robotics": [
          "Fundamentals of robotics",
          "Forward and inverse kinematics of robots",
          "Differentials motions and velocities, Jacobian and inverse Jacobian",
          "Implementation of a mobile robot",
          "Trajectory planning",
        ],
        "EENG112 Introduction to Programming": [
          "Learn pseudocode, algorithm and flowchart and write an algorithm to solve a problem",
          "Be able to declare variables of an appropriate type and write expressions to perform computations",
          "Use selection and repetition structures in programs where decisions or loops are needed",
          "Write programs that use arrays for storage",
          "Write programs using characters and strings",
          "Define functions to perform subtasks and pass parameters, learn how to use standard C library functions and understand the difference between call-by-value and call-by-reference",
          "Design programs involving decision structures, loops, functions and pointers",
          "Write, compile and debug programs in C language",
          "Gain design experience through open ended lab assignment",
        ],
        "CMPE428 Data Science": [
          "Learn Programming in R and Python",
          "Analysis of data",
          "Visualization of data",
          "Develop regression models",
          "Design classifier models",
          "Performance evaluation of classifiers",
          "Implement data clustering",
          "Select/extract discriminative attributes",
        ],
        "MECT190 Intro to Mechatronics Engineering": [
          "Understand the Fundamentals of Mechatronics Engineering.",
          "Understand the use of units/dimensions and unit conversion in engineering calculations",
          "Understand basic principles of scientific computation and engineering solutions i.e. Problem Identification, Problem Formulation and Problem Solution.",
          "Understand collection and presentation of engineering data",
          "Understand the Ethical issues and Professional Responsibilities in Engineering.",
          "Understand the fundamentals of Occupational Health and Safety, and safety practices at departmental laboratories and university campus.",
        ],
        "MECT400 Industrial Training": [
          "Understand the Organizational Structure of a company.",
          "Develop work habits and attitudes necessary for job success (technical competence, professional attitude, organization skills etc.)",
          "Develop written communication and technical report writing skills.",
          "Develop knowledge of contemporary issues.",
          "Develop an awareness for the need and applications of standards in the industry.",
        ],
        "MECT410 Introduction to Capstone Design": [
          "Define design objectives, design constraints and product specifications according to the stakeholder and project requirements.",
          "Collect and review related data such as technical information, regulations, and standards etc. from credible literature resources, published research, and patents etc. to generate solutions.",
          "Manage concept generation and concept evaluation process, analyze and compare design alternatives/possible solutions, at the system and subsystem levels, and use measures of performance or other criteria to rank alternatives",
          "Develop an effective design strategy and project plan (work breakdown structure) explaining major milestones of the project with their respective timelines, responsibilities and resource allocation (Cost) to ensure timely and within-budget completion of the project.",
          "Design a system to meet the design criteria and constraints (such as cost, economic, resource availability, environment, sustainability, safety, manufacturability, assembly, reliability, testing and maintenance, and product life cycle considerations).",
          "Develop detailed manufacturing/ simulation/ implementation plan by selecting the suitable manufacturing/ simulation/ implementation techniques.",
          "Develop the plan for verification and validation of the project objectives according to the relevant engineering standards/ requirements/ design criteria.",
          "Understand the significance of relevant engineering standards for materials, components, manufacturing and product qualification",
          "Understand the major characteristics of engineering drawings and generate engineering drawings according to the technical drawing standards (layout, assembly drawing, parts drawings, etc.)",
          "Manage design documentation and communication (both orally and in writing) using language and graphics appropriate to the technical discipline, with the necessary supporting material, to achieve desired understanding and impact.",
        ],
        "MECT411 Capstone Team Project": [
          "Define design objectives, design constraints and product specifications according to the stakeholder and project requirements.",
          "Collect and review related data such as technical information, regulations, and standards etc. from credible literature resources, published research, and patents etc. to generate solutions.",
          "Manage concept generation and concept evaluation process, analyze and compare design alternatives/possible solutions, at the system and subsystem levels, and use measures of performance or other criteria to rank alternatives",
          "Execute the design strategy and project plan (work breakdown structure) to ensure timely and within-budget completion of the project.",
          "Design a system to meet the design criteria and constraints (such as cost, economic, resource availability, environment, sustainability, safety, manufacturability, assembly, reliability, testing and maintenance, and product life cycle considerations)",
          "Execute manufacturing/ simulation/ implementation plan by selecting the suitable manufacturing/ simulation/ implementation techniques.",
          "Verification and validation of the project objectives according to the relevant engineering standards/ requirements/ design criteria.",
          "Understand the significance of relevant engineering standards for materials, components, manufacturing and product qualification.",
          "Understand the major characteristics of engineering drawings and generate engineering drawings according to the technical drawing standards (layout, assembly drawing, parts drawings, etc.)",
          "Manage design documentation and communication (both orally and in writing) using language and graphics appropriate to the technical discipline, with the necessary supporting material, to achieve desired understanding and impact.",
        ],
        "MENG446 Thermal Power Engines": [
          "Understand the thermodynamic relations, thermal cycles and basic thermodynamic analysis methods of thermal power engines",
          "Understand the basic operating principles of steam generators and their components also analyze thermodynamic performance of steam generators.",
          "Evaluate the properties of fuels and analyze the enthalpy of combustion reactions by using thermodynamic equations",
          "Analyze thermodynamic performance of gas powered power generation cycles.",
          "Perform economic analysis for thermal power plants",
          "Understand primary renewable energy sources for power generation and analyze the performance of renewable energy sourced power plants.",
          "Understand the basic operating principles and components of different types of nuclear power plants.",
          "Analyze the thermodynamic performance of a heat engine experimentally",
          "Analyze the thermodynamic performance of a PV/T unit experimentally",
        ],
        "MENG449 Introduction to Energy Management": [
          "Understand why energy management is essential for sustainability",
          "Learn the fundamental topics in energy and energy efficiency",
          "Demonstrate capability of conducting energy audits",
          "Demonstrate understanding of performing economic feasibility calculations for conservation measures",
          "Understand how energy can be saved in buildings",
          "Understand how efficient energy use can be achieved in heating and cooling applications",
          "Understand how efficient energy use can be achieved in electric and other systems",
        ],
      },
    };
  }
  let config = defaultConfig();

  function blankItem(nClo) {
    return {
      id: uid(),
      name: "",
      max: 100,
      weight: 0,
      avg: 0,
      so: new Array(7).fill(false),
      clo: new Array(nClo).fill(false),
    };
  }

  function sampleState410() {
    const names = [
      "Abstract",
      "Project chap 1",
      "Project chap 2",
      "Project chap 3",
      "Project chap 4",
      "Project chap 5",
      "References",
      "AX-A (electronic media)",
      "AX-B (standards)",
      "AIX-C (constraints)",
      "AIX-D (logbook / timeline)",
      "AX-E (engineering drawings)",
      "Overall report format",
      "Overall course total",
    ];
    const weights = [5, 5, 10, 20, 10, 10, 5, 5, 5, 5, 5, 10, 5, 100];
    const avgs = [
      80.404040404, 86.868686869, 86.868686868, 86.262626263, 81.414141414,
      76.96969697, 77.575757576, 83.232323232, 86.060606061, 80.808080808,
      84.444444444, 86.060606061, 82.222222222, 83.464646465,
    ];
    const soChecked = [
      [1, 2, 4],
      [14],
      [8, 13],
      [2, 3, 7, 9, 10],
      [14],
      [5, 6],
      [3, 7, 8],
    ];
    const cloChecked = [
      [2],
      [3],
      [4],
      [11],
      [4],
      [5],
      [6],
      [9],
      [12],
      [13],
      [],
      [],
    ];
    const items = names.map((n, idx) => {
      const it = {
        id: uid(),
        name: n,
        max: 100,
        weight: weights[idx],
        avg: avgs[idx],
        so: new Array(7).fill(false),
        clo: new Array(12).fill(false),
      };
      soChecked.forEach((list, soIdx) => {
        if (list.includes(idx + 1)) it.so[soIdx] = true;
      });
      cloChecked.forEach((list, cloIdx) => {
        if (list.includes(idx + 1)) it.clo[cloIdx] = true;
      });
      return it;
    });
    const cloLib =
      config.closByCourse["MENG410 Introduction to Capstone Design"] || [];
    const clos = Array.from(
      { length: 12 },
      (_, i) => cloLib[i] || "CLO " + (i + 1),
    );
    return {
      meta: {
        program: "Mechanical Engineering",
        course: "MENG410 Introduction to Capstone Design",
        semester: "Fall 2021-2022",
      },
      items,
      clos,
      ice: {
        issuesPrev: "",
        issuesCurrent: "",
        actionPlan: "",
        status: "open",
      },
      approvals: {
        instructor: { name: "", date: "" },
        assistant: { name: "", date: "" },
        coordinator: { name: "", date: "" },
        chair: { name: "", date: "" },
      },
      locked: false,
    };
  }

  function sampleState411() {
    const names = [
      "Abstract",
      "Project chap 1",
      "Project chap 2",
      "Project chap 3",
      "Project chap 4",
      "Project chap 5",
      "Project chap 6",
      "Project chap 7",
      "References",
      "AX-A (electronic media)",
      "AX-B (standards)",
      "AIX-C (constraints)",
      "AIX-D (logbook / timeline)",
      "AX-E (engineering drawings)",
      "Overall report format",
      "Presentation & demonstration",
    ];
    const weights = [
      2.5, 2.5, 5, 5, 5, 5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 5, 2.5, 50,
    ];
    const avgs = [
      76.50793650793652, 78.73015873015873, 78.41269841269842,
      76.19047619047619, 74.28571428571429, 70.4761904761905, 68.88888888888891,
      71.74603174603178, 72.69841269841271, 90.7936507936508, 81.58730158730158,
      78.73015873015872, 90.47619047619045, 86.031746031746, 72.6984126984127,
      82.85714285714285,
    ];
    const soChecked = [
      [1, 2, 4],
      [],
      [10, 15, 16],
      [2, 3, 9, 11, 12, 16],
      [],
      [5, 6, 7, 8],
      [3, 9, 10],
    ];
    const cloChecked = [
      [2],
      [3],
      [4],
      [13],
      [4],
      [5],
      [6],
      [11],
      [14],
      [15],
      [],
      [],
    ];
    const items = names.map((n, idx) => {
      const it = {
        id: uid(),
        name: n,
        max: 100,
        weight: weights[idx],
        avg: avgs[idx],
        so: new Array(7).fill(false),
        clo: new Array(12).fill(false),
      };
      soChecked.forEach((list, soIdx) => {
        if (list.includes(idx + 1)) it.so[soIdx] = true;
      });
      cloChecked.forEach((list, cloIdx) => {
        if (list.includes(idx + 1)) it.clo[cloIdx] = true;
      });
      return it;
    });
    const cloLib = config.closByCourse["MENG411 Capstone Team Project"] || [];
    const clos = Array.from(
      { length: 12 },
      (_, i) => cloLib[i] || "CLO " + (i + 1),
    );
    return {
      meta: {
        program: "Mechanical Engineering",
        course: "MENG411 Capstone Team Project",
        semester: "Fall 2021-2022",
      },
      items,
      clos,
      ice: {
        issuesPrev: "",
        issuesCurrent: "",
        actionPlan: "",
        status: "open",
      },
      approvals: {
        instructor: { name: "", date: "" },
        assistant: { name: "", date: "" },
        coordinator: { name: "", date: "" },
        chair: { name: "", date: "" },
      },
      locked: false,
    };
  }

  function freshState(meta) {
    const m =
      meta && meta.course
        ? meta
        : {
            program: PROGRAMS[0],
            course: (config.coursesByProgram[PROGRAMS[0]] || [])[0] || "",
            semester: config.semesters[0] || "Fall 2025-2026",
          };
    const cloLib = config.closByCourse[m.course];
    const clos =
      cloLib && cloLib.length ? cloLib.slice() : ["CLO 1", "CLO 2", "CLO 3"];
    return {
      meta: {
        program: m.program,
        course: m.course,
        semester: m.semester,
      },
      items: [blankItem(clos.length)],
      clos,
      ice: {
        issuesPrev: "",
        issuesCurrent: "",
        actionPlan: "",
        status: "open",
      },
      approvals: {
        instructor: { name: "", date: "" },
        assistant: { name: "", date: "" },
        coordinator: { name: "", date: "" },
        chair: { name: "", date: "" },
      },
      locked: false,
    };
  }

  let state = sampleState410();
  function isLocked() {
    return !!state.locked;
  }
  function dis() {
    return isLocked() ? "disabled" : "";
  }

  function ensureListsContainState() {
    const p = state.meta.program;
    if (!config.coursesByProgram[p]) config.coursesByProgram[p] = [];
    if (
      state.meta.course &&
      !config.coursesByProgram[p].includes(state.meta.course)
    )
      config.coursesByProgram[p].unshift(state.meta.course);
    if (state.meta.semester && !config.semesters.includes(state.meta.semester))
      config.semesters.unshift(state.meta.semester);
  }

  function computeOutcome(key, idx) {
    // (avg/max) converts each item's class average to a 0-1 ratio; weighting by each
    // item's own %weight (not just its max mark) matches the revised CAT workbook's
    // formula, so a heavily-weighted item pulls the outcome's attainment more than a
    // lightly-weighted one — this replaces the older max-mark-only weighting.
    let sumWeighted = 0,
      sumWeight = 0,
      n = 0;
    state.items.forEach((it) => {
      if (it[key][idx]) {
        const max = Number(it.max) || 0,
          weight = Number(it.weight) || 0;
        if (max > 0) {
          sumWeighted += ((Number(it.avg) || 0) / max) * weight;
          sumWeight += weight;
          n++;
        }
      }
    });
    if (n === 0 || sumWeight === 0)
      return { value: null, weight: sumWeight, n: 0 };
    return {
      value: (sumWeighted / sumWeight) * 100,
      weight: sumWeight,
      n,
    };
  }
  function classify(weight) {
    if (weight >= 25) return "H";
    if (weight > 10) return "M";
    return "L";
  }
  function fmt(v) {
    return v === null ? "—" : String(Math.round(v));
  }

  // Recomputed on every render from the CURRENT checkbox state (state.items[i][key][idx]),
  // so toggling a box in the UI updates this the same way it updates the class-average
  // attainment — nothing here is frozen from whatever was checked at import time.
  function computeThresholdPct(key, idx) {
    if (!state.roster || state.roster.length === 0)
      return { pct: null, counted: 0 };
    let meeting = 0,
      counted = 0;
    state.roster.forEach((scores) => {
      let num = 0,
        den = 0;
      state.items.forEach((it, i) => {
        const score = scores[i];
        // Blank cells count as zero here (per owner's instruction). Class averages are unaffected.
        if (it[key][idx] && it.max > 0) {
          const s = score === null || score === undefined ? 0 : score;
          num += (s / it.max) * it.weight;
          den += it.weight;
        }
      });
      if (den === 0) return; // no checked item with a max mark at all — nothing to score against
      counted++;
      const pct = (num / den) * 100;
      if (meetsThreshold(pct)) meeting++;
    });
    return {
      pct: counted > 0 ? (meeting / counted) * 100 : null,
      counted,
    };
  }

  function barChartSVG(rows) {
    const rowH = 30,
      padTop = 10,
      labelW = 190,
      chartX = 200,
      chartW = 420;
    const H = rows.length * rowH + padTop * 2;
    const threshX = chartX + (chartW * THRESHOLD) / 100;
    const body = rows
      .map((r, i) => {
        const y = padTop + i * rowH;
        const val = r.value === null ? 0 : Math.min(100, r.value);
        const barW = (chartW * val) / 100;
        const below = r.value !== null && !meetsThreshold(r.value);
        const color =
          r.value === null
            ? "var(--hint)"
            : below
              ? "var(--warn)"
              : "var(--accent)";
        const label =
          r.label.length > 26 ? r.label.slice(0, 25) + "…" : r.label;
        return `<text x="${labelW}" y="${y + rowH / 2 + 4}" text-anchor="end" class="chart-label"><title>${esc(r.label)}</title>${esc(label)}</text>
<rect x="${chartX}" y="${y + 7}" width="${chartW}" height="14" rx="3" style="fill:var(--line);opacity:0.5"/>
<rect x="${chartX}" y="${y + 7}" width="${barW}" height="14" rx="3" style="fill:${color}"/>
<text x="${chartX + chartW + 10}" y="${y + rowH / 2 + 4}" class="chart-value">${fmt(r.value)}</text>`;
      })
      .join("");
    return `<svg viewBox="0 0 720 ${H}" width="100%" style="overflow:visible">
${body}
<line x1="${threshX}" y1="0" x2="${threshX}" y2="${H}" stroke="var(--warn)" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.85"/>
</svg>`;
  }

  function ledgerRow(label, text, r, studentPct, studentCount) {
    const pct = r.value === null ? 0 : Math.min(100, r.value);
    const below = r.value !== null && !meetsThreshold(r.value);
    const pillClass = r.value === null ? "na" : below ? "low" : "ok";
    const pillText =
      r.value === null
        ? "No data"
        : below
          ? "Below threshold"
          : "Meets threshold";
    const studentLine =
      studentPct !== undefined && studentPct !== null
        ? `<div class="sub">${studentPct.toFixed(0)}% of ${studentCount} students individually &ge; ${THRESHOLD}%</div>`
        : "";
    return `<div class="ledger-row">
<div class="mono sub">${label}</div>
<div>${esc(text)}${r.weight !== undefined && r.n > 0 ? `<div class="sub">Weight covered ${r.weight.toFixed(0)}% &middot; class ${classify(r.weight)}</div>` : ""}${studentLine}</div>
<div class="mono" style="text-align:right">${fmt(r.value)}</div>
<div class="bar-col">
<div class="bar-track"><div class="bar-fill ${below ? "below" : ""}" style="width:${pct}%"></div><div class="bar-thresh" style="left:${THRESHOLD}%"></div></div>
<div style="margin-top:4px"><span class="pill ${pillClass}">${pillText}</span></div>
</div>
</div>`;
  }

  function renderComputed() {
    const soResults = SOS.map((_, i) => computeOutcome("so", i));
    const cloResults = state.clos.map((_, i) => computeOutcome("clo", i));
    document.getElementById("so-chart-body").innerHTML = barChartSVG(
      SOS.map((t, i) => ({
        label: "SO" + (i + 1) + " — " + t,
        value: soResults[i].value,
      })),
    );
    document.getElementById("clo-chart-body").innerHTML = barChartSVG(
      state.clos.map((name, i) => ({
        label: name,
        value: cloResults[i].value,
      })),
    );
    document.getElementById("so-ledger-body").innerHTML = SOS.map((text, i) => {
      const tp = computeThresholdPct("so", i);
      return ledgerRow("SO" + (i + 1), text, soResults[i], tp.pct, tp.counted);
    }).join("");
    document.getElementById("clo-ledger-body").innerHTML = state.clos
      .map((name, i) => {
        const tp = computeThresholdPct("clo", i);
        return ledgerRow(
          String(i + 1),
          name,
          cloResults[i],
          tp.pct,
          tp.counted,
        );
      })
      .join("");
    const stat = document.getElementById("stat-strip");
    if (stat) {
      const soA = soResults.filter((r) => r.value !== null),
        cloA = cloResults.filter((r) => r.value !== null);
      const soMeet = soA.filter((r) => meetsThreshold(r.value)).length,
        cloMeet = cloA.filter((r) => meetsThreshold(r.value)).length;
      stat.innerHTML = `
<div class="stat"><div class="num mono">${soMeet}/${soA.length}</div><div class="lbl">SOs &ge; ${THRESHOLD}</div></div>
<div class="stat"><div class="num mono">${cloMeet}/${cloA.length}</div><div class="lbl">CLOs &ge; ${THRESHOLD}</div></div>
<div class="stat"><div class="num mono">${state.items.length}</div><div class="lbl">Assessment items</div></div>`;
    }
  }

  function setSaveMsg(msg) {
    const el = document.getElementById("save-msg-el");
    if (el) el.textContent = msg;
  }

  function renderHeader() {
    const el = document.getElementById("blk-header");
    const courseOptions = config.coursesByProgram[state.meta.program] || [];
    el.innerHTML = `
<div class="eyebrow no-print">Department of Mechanical Engineering</div>
<h1>Course Assessment Tool (CAT)</h1>
<div class="sub no-print">Same attainment formula as your CAT workbook: for each outcome, sum of class averages of the items checked, divided by the sum of their max marks.</div>
<div class="print-only sub">${esc(state.meta.program)} &middot; ${esc(state.meta.course)} &middot; ${esc(state.meta.semester)}${isLocked() ? " &middot; Locked (signed)" : ""}</div>
<div class="note no-print">${USING_CLOUD_STORAGE ? "Saved records are shared with everyone using this tool inside Claude." : "Running as a standalone file: saved records stay in this browser only, and won\u2019t sync with colleagues unless you\u2019re back inside Claude."}</div>
<div class="grid3 no-print" style="margin-top:16px">
<div><label class="field-label">Program</label>
  <select id="f-program">${PROGRAMS.map((p) => `<option value="${esc(p)}" ${p === state.meta.program ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>
</div>
<div><label class="field-label">Course</label>
  <select id="f-course">${courseOptions.length ? courseOptions.map((c) => `<option value="${esc(c)}" ${c === state.meta.course ? "selected" : ""}>${esc(c)}</option>`).join("") : '<option value="">No courses yet — add below</option>'}</select>
  <div class="row" style="margin-top:4px"><button class="ghost" id="btn-edit-courses" style="font-size:11px">Edit course list</button></div>
</div>
<div><label class="field-label">Semester</label>
  <select id="f-semester">${config.semesters.map((s) => `<option value="${esc(s)}" ${s === state.meta.semester ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
  <div class="row" style="margin-top:4px"><button class="ghost" id="btn-add-semester" style="font-size:11px">+ Add next semester</button></div>
</div>
</div>
<div id="edit-courses-panel" class="no-print"></div>
<div class="row no-print" style="margin-top:14px">
<button class="primary" id="btn-save">Save this semester</button>
<button id="btn-new">Start new semester</button>
<button id="btn-print">Print / Save as PDF</button>
<span class="savemsg" id="save-msg-el"></span>
</div>
<div class="row no-print" style="margin-top:8px">
<button id="btn-sample410" style="font-size:11px">Load MENG410 sample</button>
<button id="btn-sample411" style="font-size:11px">Load MENG411 sample</button>
</div>
<div class="stat-strip no-print" id="stat-strip"></div>
<div id="saved-list" class="no-print"></div>
`;
    document.getElementById("f-program").onchange = (e) => {
      state.meta.program = e.target.value;
      state.meta.course =
        (config.coursesByProgram[state.meta.program] || [])[0] || "";
      renderHeader();
    };
    document.getElementById("f-course").onchange = (e) => {
      state.meta.course = e.target.value;
    };
    document.getElementById("f-semester").onchange = (e) => {
      state.meta.semester = e.target.value;
    };
    document.getElementById("btn-edit-courses").onclick = () => {
      const panel = document.getElementById("edit-courses-panel");
      const current = (config.coursesByProgram[state.meta.program] || []).join(
        "\n",
      );
      panel.innerHTML = `<div class="edit-list-panel">
<label class="field-label">Course codes for ${esc(state.meta.program)} — one per line</label>
<textarea id="course-list-txt">${esc(current)}</textarea>
<div class="row" style="margin-top:8px"><button class="primary" id="btn-save-courses">Save list</button></div>
</div>`;
      document.getElementById("btn-save-courses").onclick = () => {
        const lines = document
          .getElementById("course-list-txt")
          .value.split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        config.coursesByProgram[state.meta.program] = lines;
        state.meta.course = lines[0] || "";
        persistConfig();
        renderHeader();
      };
    };
    document.getElementById("btn-add-semester").onclick = () => {
      const last = config.semesters[config.semesters.length - 1];
      const nxt = nextSemester(last);
      if (nxt) {
        config.semesters.push(nxt);
        state.meta.semester = nxt;
        persistConfig();
        renderHeader();
      }
    };
    document.getElementById("btn-save").onclick = saveSemester;
    document.getElementById("btn-new").onclick = () => {
      if (
        confirm(
          "Start a blank new semester for " +
            (state.meta.course || "this course") +
            "? Unsaved changes will be lost.",
        )
      ) {
        state = freshState(state.meta);
        renderAll();
      }
    };
    document.getElementById("btn-print").onclick = () => {
      window.print();
    };
    document.getElementById("btn-sample410").onclick = () => {
      state = sampleState410();
      ensureListsContainState();
      renderAll();
    };
    document.getElementById("btn-sample411").onclick = () => {
      state = sampleState411();
      ensureListsContainState();
      renderAll();
    };
    refreshSavedList();
  }

  let importedWorkbook = null;

  function renderImportPanel() {
    const el = document.getElementById("blk-import");
    el.innerHTML = `
<h2>Import from Excel</h2>
<div class="sub">Upload a course CAT workbook (.xlsm/.xlsx) built on the department template and pick a semester tab to bring its items and SO/CLO mapping in automatically, instead of retyping them. Pick the Program and Course above first.</div>
<div class="row" style="margin-top:10px"><input type="file" id="import-file" accept=".xlsx,.xlsm,.xls" style="max-width:340px"></div>
<div id="import-sheet-picker" style="margin-top:10px"></div>
<div id="import-status" class="note"></div>
`;
    document.getElementById("import-file").onchange = handleImportFile;
  }

  async function handleImportFile(e) {
    const file = e.target.files[0];
    const statusEl = document.getElementById("import-status");
    const pickerEl = document.getElementById("import-sheet-picker");
    pickerEl.innerHTML = "";
    if (!file) return;
    if (typeof XLSX === "undefined") {
      statusEl.textContent =
        "Still loading the Excel reader — wait a moment and choose the file again.";
      return;
    }
    statusEl.textContent = "Reading " + file.name + " …";
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      importedWorkbook = wb;
      const dataSheets = wb.SheetNames.filter((n) => {
        const low = n.toLowerCase().trim();
        return (
          low.slice(-3) !== "(s)" &&
          low.indexOf("template") !== 0 &&
          low !== "student outcomes" &&
          low !== "grading criteria"
        );
      });
      if (dataSheets.length === 0) {
        statusEl.textContent = "No semester tabs found in this workbook.";
        return;
      }
      pickerEl.innerHTML = `
<label class="field-label">Semester tab to import</label>
<select id="import-sheet-select">${dataSheets.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select>
<div class="row" style="margin-top:8px"><button class="primary" id="btn-do-import">Import this sheet</button></div>
`;
      document.getElementById("btn-do-import").onclick = () =>
        doImport(document.getElementById("import-sheet-select").value);
      statusEl.textContent =
        "Found " +
        dataSheets.length +
        " semester tab(s) — pick one and import.";
    } catch (err) {
      statusEl.textContent = "Could not read that file: " + err.message;
    }
  }

  function parseOldTemplate(rows) {
    const rowMax = rows[2] || [],
      rowWeight = rows[3] || [],
      rowName = rows[4] || [],
      rowAvg = rows[5] || [];
    let nItems = 0;
    for (let c = 4; c < rowName.length; c++) {
      if (rowName[c] === undefined || rowName[c] === "") {
        break;
      }
      nItems++;
    }
    if (nItems === 0) return null;
    const items = [];
    for (let i = 0; i < nItems; i++) {
      const c = 4 + i;
      items.push({
        id: uid(),
        name: String(rowName[c] || "").trim(),
        max: parseFloat(rowMax[c]) || 100,
        weight: parseFloat(rowWeight[c]) || 0,
        avg: parseFloat(rowAvg[c]) || 0,
        so: new Array(7).fill(false),
        clo: new Array(12).fill(false),
      });
    }
    for (let so = 0; so < 7; so++) {
      const r = rows[9 + so] || [];
      for (let i = 0; i < nItems; i++) {
        if (String(r[4 + i]).trim() === "þ") items[i].so[so] = true;
      }
    }
    let cloCount = 0;
    for (let clo = 0; clo < 12; clo++) {
      const r = rows[40 + clo];
      if (!r || r.length === 0) continue;
      cloCount = clo + 1;
      for (let i = 0; i < nItems; i++) {
        if (String(r[4 + i]).trim() === "þ") items[i].clo[clo] = true;
      }
    }
    if (cloCount === 0) cloCount = 3;
    items.forEach((it) => {
      it.clo = it.clo.slice(0, cloCount);
    });
    return { items, cloCount, roster: null };
  }

  function colLetter(idx0) {
    let s = "",
      n = idx0 + 1;
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  // The revised template nests sub-items inside a group whose own total column
  // carries the group's real %weight (row 4). A sub-item's own row-4 cell is left
  // empty in the source file, so "does this column's row-4 cell exist at all" is
  // what tells a leaf apart from a group-total column — not its value.
  function isGroupTotalCol(ws, colIdx0) {
    return Object.prototype.hasOwnProperty.call(ws, colLetter(colIdx0) + "4");
  }

  // Groups a run of item columns into { rollupIdx, leafIdxs } blocks. A rollup with
  // no leaves before it (a standalone group, e.g. "Project" used with no sub-items)
  // is returned with an empty leafIdxs and is kept as its own item further down.
  function groupItemColumns(ws, startCol, endCol) {
    const groups = [];
    let pending = [];
    for (let c = startCol; c < endCol; c++) {
      if (isGroupTotalCol(ws, c)) {
        groups.push({ rollupIdx: c, leafIdxs: pending });
        pending = [];
      } else pending.push(c);
    }
    return { groups, trailingLeaves: pending };
  }

  // The revised department template adds a full student roster (one row per student).
  // We keep only an anonymized, position-matched array of per-item scores (no names
  // or IDs) so the tool can compute what share of students individually clear the
  // threshold — live, from whatever SO/CLO boxes are currently checked, the same way
  // the class-average attainment already recomputes live.
  function parseNewTemplate(rows, ws) {
    const ITEM_START = 8; // column I
    const nameRow = rows[4] || []; // row 5
    let itemEnd = -1;
    for (let c = ITEM_START; c < nameRow.length; c++) {
      if (
        String(nameRow[c] || "")
          .trim()
          .toUpperCase() === "TOTAL"
      ) {
        itemEnd = c;
        break;
      }
    }
    if (itemEnd === -1 || itemEnd <= ITEM_START) return null;

    const weightFracRow = rows[1] || [],
      maxRow = rows[2] || [];
    let avgRowIdx = -1;
    for (let r = 0; r < rows.length; r++) {
      if (String((rows[r] || [])[3] || "").trim() === "Avg.") {
        avgRowIdx = r;
        break;
      }
    }
    if (avgRowIdx === -1) return null;

    let soLabelIdx = -1,
      cloLabelIdx = -1;
    for (let r = 0; r < rows.length; r++) {
      const v = (rows[r] || [])[7];
      if (v === "SOs") soLabelIdx = r;
      if (v === "CLOs") cloLabelIdx = r;
    }
    if (soLabelIdx === -1) return null;

    // A blank cell means "didn't take this one" — never treat it as a zero.
    function cellIsBlank(v) {
      return v === undefined || v === null || String(v).trim() === "";
    }

    // Real student rows only, built first so we can tell which columns actually
    // carry grades before deciding how to collapse each group.
    const studentRows = [];
    for (let r = 7; r < avgRowIdx; r++) {
      const row = rows[r];
      if (!row) continue;
      const sid = row[2];
      if (cellIsBlank(sid)) continue;
      studentRows.push(row);
    }
    function colHasRealData(c) {
      return studentRows.some(
        (row) => !cellIsBlank(row[c]) && !isNaN(parseFloat(row[c])),
      );
    }

    // Always keep the head (group-total) assessment as its own item — it's the
    // column instructors most often map SOs/CLOs to. Alongside it, keep any
    // sub-assessment that actually has grades; a sub-item left entirely blank is
    // dropped so it doesn't clutter the list, but one with real data stays even
    // if the head also has data — each is read from its own checkbox row, so
    // there's no cross-propagation to get out of sync.
    const { groups, trailingLeaves } = groupItemColumns(
      ws,
      ITEM_START,
      itemEnd,
    );
    const keepCols = []; // final column indices that become items, in sheet order
    groups.forEach((g) => {
      keepCols.push(g.rollupIdx);
      g.leafIdxs.forEach((li) => {
        if (colHasRealData(li)) keepCols.push(li);
      });
    });
    keepCols.push(...trailingLeaves);
    keepCols.sort((a, b) => a - b);

    function checkedAt(rowArr, colIdx) {
      return String(rowArr[colIdx] || "").trim() === "þ";
    }

    const items = keepCols.map((c) => ({
      id: uid(),
      name: String(nameRow[c] || "").trim(),
      max: parseFloat(maxRow[c]) || 0,
      weight: parseFloat(weightFracRow[c]) || 0,
      avg: 0,
      so: new Array(7).fill(false),
      clo: new Array(12).fill(false),
      // totalShare: what this item contributes to the course weight total. Only a
      // group head contributes, using the group's weight from row 4 (rows[3]); sub-items
      // contribute 0 so the same assessment is not counted twice.
      isHead: isGroupTotalCol(ws, c),
      totalShare: isGroupTotalCol(ws, c)
        ? parseFloat((rows[3] || [])[c]) || 0
        : 0,
    }));

    function readOutcomeRows(labelIdx, count) {
      const result = [];
      for (let k = 0; k < count; k++) {
        const r = rows[labelIdx + 1 + k];
        if (!r) {
          result.push(null);
          continue;
        }
        result.push(r);
      }
      return result;
    }
    function applyOutcome(rowArr, key, idx) {
      if (!rowArr) return;
      keepCols.forEach((c, i) => {
        if (checkedAt(rowArr, c)) items[i][key][idx] = true;
      });
    }

    readOutcomeRows(soLabelIdx, 7).forEach((r, so) =>
      applyOutcome(r, "so", so),
    );
    let cloCount = 0;
    if (cloLabelIdx > -1) {
      const cloRows = readOutcomeRows(cloLabelIdx, 12);
      cloRows.forEach((r, clo) => {
        if (r) cloCount = clo + 1;
      });
      cloRows.forEach((r, clo) => applyOutcome(r, "clo", clo));
    }
    if (cloCount === 0) cloCount = 3;
    items.forEach((it) => {
      it.clo = it.clo.slice(0, cloCount);
    });

    // Anonymized, null-aware roster: one array of leaf-item scores per student, no ID
    // or name kept. A blank cell stays null here rather than becoming a zero, so it
    // can be excluded from that item's average and from that student's own SO/CLO
    // percentage — exactly like a grade left blank in Excel doesn't drag down AVERAGE().
    const roster = studentRows.map((row) =>
      keepCols.map((c) => {
        const v = row[c];
        if (cellIsBlank(v)) return null;
        const n = parseFloat(v);
        return isNaN(n) ? null : n;
      }),
    );
    items.forEach((it, i) => {
      const vals = roster.map((r) => r[i]).filter((v) => v !== null);
      it.avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });

    return { items, cloCount, roster };
  }

  function doImport(sheetName) {
    const statusEl = document.getElementById("import-status");
    if (!state.meta.course) {
      statusEl.textContent =
        "Pick a Course above first, so the import knows which course this belongs to.";
      return;
    }
    try {
      const ws = importedWorkbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: "",
      });
      const isNew =
        String((rows[4] || [])[2] || "")
          .trim()
          .toLowerCase() === "student no.";
      const parsed = isNew
        ? parseNewTemplate(rows, ws)
        : parseOldTemplate(rows);
      if (!parsed) {
        statusEl.textContent =
          'Could not recognize the layout of "' +
          sheetName +
          '" — it may not be built on the department template.';
        return;
      }

      const cloLib = config.closByCourse[state.meta.course];
      const clos = Array.from(
        { length: parsed.cloCount },
        (_, i) => (cloLib && cloLib[i]) || "CLO " + (i + 1),
      );

      state = {
        meta: {
          program: state.meta.program,
          course: state.meta.course,
          semester: sheetName,
        },
        items: parsed.items,
        clos,
        roster: parsed.roster || null,
        ice: {
          issuesPrev: "",
          issuesCurrent: "",
          actionPlan: "",
          status: "open",
        },
        approvals: {
          instructor: { name: "", date: "" },
          assistant: { name: "", date: "" },
          coordinator: { name: "", date: "" },
          chair: { name: "", date: "" },
        },
        locked: false,
      };
      renderAll();
      setSaveMsg(
        "Imported " +
          parsed.items.length +
          " items" +
          (parsed.roster ? " and " + parsed.roster.length + " students" : "") +
          ' from "' +
          sheetName +
          '" — review, then Save.',
      );
    } catch (err) {
      statusEl.textContent = "Import failed: " + err.message;
    }
  }

  function renderItems() {
    const el = document.getElementById("blk-items");
    el.innerHTML = `
<h2>Assessment items</h2>
<div class="sub">Max mark, weight, and class average — entered once per item, same as row 3-6 of your CAT.</div>
<div class="wrap-x">
<table>
  <tr><th style="width:34%">Item</th><th>Max mark</th><th>Weight %</th><th>Class avg</th><th></th></tr>
  ${state.items
    .map(
      (it, i) => `
    <tr>
      <td><input type="text" ${dis()} data-role="name" data-i="${i}" value="${esc(it.name)}" placeholder="e.g. Midterm exam"></td>
      <td><input type="number" ${dis()} data-role="max" data-i="${i}" value="${it.max}"></td>
      <td><input type="number" ${dis()} data-role="weight" data-i="${i}" value="${it.weight}"></td>
      <td><input type="number" ${dis()} data-role="avg" data-i="${i}" value="${it.avg}" step="0.01"></td>
      <td><button class="ghost" ${dis()} data-role="rmitem" data-i="${i}" aria-label="Remove item">&#10005;</button></td>
    </tr>`,
    )
    .join("")}
</table>
</div>
${(() => {
  const wSum = state.items.reduce(
    (s, it) =>
      s +
      ((it.totalShare !== undefined
        ? Number(it.totalShare)
        : Number(it.weight)) || 0),
    0,
  );
  const ok = Math.abs(wSum - 100) <= 0.01;
  return `<div class="note" style="font-weight:700;color:${ok ? "#1E7A34" : "#B3261E"}">Weights sum to ${wSum.toFixed(1)}%${ok ? "" : ", not 100% — check before signing off."}</div>`;
})()}
<button id="btn-additem" ${dis()} style="margin-top:10px">+ Add item</button>
`;
    el.querySelectorAll("[data-role=name]").forEach((inp) => {
      inp.oninput = (e) => {
        state.items[+e.target.dataset.i].name = e.target.value;
      };
    });
    ["max", "weight", "avg"].forEach((role) => {
      el.querySelectorAll(`[data-role=${role}]`).forEach((inp) => {
        inp.oninput = (e) => {
          state.items[+e.target.dataset.i][role] =
            parseFloat(e.target.value) || 0;
          renderComputed();
        };
      });
    });
    el.querySelectorAll("[data-role=rmitem]").forEach((btn) => {
      btn.onclick = (e) => {
        state.items.splice(+e.currentTarget.dataset.i, 1);
        renderAll();
      };
    });
    document.getElementById("btn-additem").onclick = () => {
      state.items.push(blankItem(state.clos.length));
      renderAll();
    };
  }

  function renderSoMatrix() {
    const el = document.getElementById("blk-so-matrix");
    el.innerHTML = `
<h2>Student outcome mapping</h2>
<div class="sub">Check every item that supports each SO — mirrors the checkbox matrix in your CAT.</div>
<div class="wrap-x">
<table>
  <tr><th style="width:34%">Item</th>${SOS.map((_, i) => `<th style="text-align:center">SO${i + 1}</th>`).join("")}</tr>
  ${state.items
    .map(
      (it, i) => `
    <tr><td>Item ${i + 1}${it.name ? ` &middot; <span class="sub">${esc(it.name)}</span>` : ""}</td>
    ${SOS.map((_, k) => `<td style="text-align:center"><input class="chk" type="checkbox" ${dis()} data-role="so" data-i="${i}" data-k="${k}" ${it.so[k] ? "checked" : ""}></td>`).join("")}</tr>`,
    )
    .join("")}
</table>
</div>
`;
    el.querySelectorAll("[data-role=so]").forEach((cb) => {
      cb.onchange = (e) => {
        state.items[+e.target.dataset.i].so[+e.target.dataset.k] =
          e.target.checked;
        renderComputed();
      };
    });
  }

  function renderCloMatrix() {
    const el = document.getElementById("blk-clo-matrix");
    el.innerHTML = `
<h2>Course learning outcome mapping</h2>
<div class="sub">CLOs are course-specific — name them from your syllabus, add or remove as needed.</div>
<div class="chip-row">
${state.clos.map((c, i) => `<span class="chip"><input type="text" ${dis()} data-role="cloname" data-i="${i}" value="${esc(c)}" style="width:${Math.max(50, c.length * 7)}px"><button class="ghost" ${dis()} data-role="rmclo" data-i="${i}">&#10005;</button></span>`).join("")}
<button id="btn-addclo" ${dis()}>+ Add CLO</button>
</div>
<div class="wrap-x" style="margin-top:12px">
<table>
  <tr><th style="width:34%">Item</th>${state.clos.map((_, i) => `<th style="text-align:center">${i + 1}</th>`).join("")}</tr>
  ${state.items
    .map(
      (it, i) => `
    <tr><td>Item ${i + 1}${it.name ? ` &middot; <span class="sub">${esc(it.name)}</span>` : ""}</td>
    ${state.clos.map((_, k) => `<td style="text-align:center"><input class="chk" type="checkbox" ${dis()} data-role="clo" data-i="${i}" data-k="${k}" ${it.clo[k] ? "checked" : ""}></td>`).join("")}</tr>`,
    )
    .join("")}
</table>
</div>
`;
    el.querySelectorAll("[data-role=clo]").forEach((cb) => {
      cb.onchange = (e) => {
        state.items[+e.target.dataset.i].clo[+e.target.dataset.k] =
          e.target.checked;
        renderComputed();
      };
    });
    el.querySelectorAll("[data-role=cloname]").forEach((inp) => {
      inp.oninput = (e) => {
        state.clos[+e.target.dataset.i] = e.target.value;
        renderComputed();
      };
    });
    el.querySelectorAll("[data-role=rmclo]").forEach((btn) => {
      btn.onclick = (e) => {
        const i = +e.currentTarget.dataset.i;
        state.clos.splice(i, 1);
        state.items.forEach((it) => it.clo.splice(i, 1));
        renderAll();
      };
    });
    document.getElementById("btn-addclo").onclick = () => {
      state.clos.push("CLO " + (state.clos.length + 1));
      state.items.forEach((it) => it.clo.push(false));
      renderAll();
    };
  }

  function renderIce() {
    const el = document.getElementById("blk-ice");
    el.innerHTML = `
<h2>Instructor course evaluation</h2>
<div class="sub">The continuous-improvement record, kept with the numbers instead of a separate binder page.</div>
<div style="margin-top:12px"><label class="field-label">Issues faced in previous offering</label>
<textarea ${dis()} data-role="issuesPrev">${esc(state.ice.issuesPrev)}</textarea></div>
<div style="margin-top:12px"><label class="field-label">Issues faced in this offering</label>
<textarea ${dis()} data-role="issuesCurrent">${esc(state.ice.issuesCurrent)}</textarea></div>
<div style="margin-top:12px"><label class="field-label">Action plan for continuous improvement</label>
<textarea ${dis()} data-role="actionPlan">${esc(state.ice.actionPlan)}</textarea></div>
<div style="margin-top:12px; max-width:280px"><label class="field-label">Status</label>
<select ${dis()} data-role="status">
  <option value="open" ${state.ice.status === "open" ? "selected" : ""}>Open — no action yet</option>
  <option value="implemented" ${state.ice.status === "implemented" ? "selected" : ""}>Action implemented</option>
  <option value="verified" ${state.ice.status === "verified" ? "selected" : ""}>Verified next offering</option>
</select>
</div>
`;
    ["issuesPrev", "issuesCurrent", "actionPlan"].forEach((role) => {
      el.querySelector(`[data-role=${role}]`).oninput = (e) => {
        state.ice[role] = e.target.value;
      };
    });
    el.querySelector("[data-role=status]").onchange = (e) => {
      state.ice.status = e.target.value;
    };
  }

  function renderApprovals() {
    const el = document.getElementById("blk-approvals");
    const roles = [
      ["instructor", "Course instructor"],
      ["assistant", "Course assistant"],
      ["coordinator", "Program coordinator"],
      ["chair", "Department chair"],
    ];
    const chairReady =
      state.approvals.chair.name.trim() && state.approvals.chair.date;
    el.innerHTML = `
<h2>Approvals</h2>
<div class="sub">Sign-off record for this course assessment, in place of the wet-ink signature line on the printed CAT.</div>
${isLocked() ? `<div class="stat-strip" style="border-left-color:var(--warn)"><div class="stat"><div class="lbl" style="color:var(--warn);font-weight:600">&#128274; Locked — signed by ${esc(state.approvals.chair.name)} on ${esc(state.approvals.chair.date)}</div></div></div>` : ""}
${roles
  .map(
    ([key, label]) => `
<div class="approval-row">
  <div class="role">${label}</div>
  <div><label class="field-label">Name</label><input type="text" ${dis()} data-role="apname" data-key="${key}" value="${esc(state.approvals[key].name)}" placeholder="Full name"></div>
  <div><label class="field-label">Date</label><input type="date" ${dis()} data-role="apdate" data-key="${key}" value="${esc(state.approvals[key].date)}"></div>
</div>`,
  )
  .join("")}
<div class="row" style="margin-top:14px">
${
  isLocked()
    ? `<button id="btn-unlock">Reopen (unlock record)</button><span class="note">Reopening clears nothing — it just allows edits again.</span>`
    : `<button class="primary" id="btn-lock" ${chairReady ? "" : "disabled"}>Confirm Chair approval & lock record</button>${chairReady ? "" : '<span class="note">Fill in the Chair name and date above to enable.</span>'}`
}
</div>
`;
    el.querySelectorAll("[data-role=apname]").forEach((inp) => {
      inp.oninput = (e) => {
        state.approvals[e.target.dataset.key].name = e.target.value;
        if (e.target.dataset.key === "chair") renderApprovals();
      };
    });
    el.querySelectorAll("[data-role=apdate]").forEach((inp) => {
      inp.oninput = (e) => {
        state.approvals[e.target.dataset.key].date = e.target.value;
        if (e.target.dataset.key === "chair") renderApprovals();
      };
    });
    const lockBtn = document.getElementById("btn-lock");
    if (lockBtn)
      lockBtn.onclick = () => {
        state.locked = true;
        renderAll();
        setSaveMsg("Record locked — remember to Save.");
      };
    const unlockBtn = document.getElementById("btn-unlock");
    if (unlockBtn)
      unlockBtn.onclick = () => {
        if (confirm("Reopen this signed record for editing?")) {
          state.locked = false;
          renderAll();
          setSaveMsg("Record reopened — remember to Save.");
        }
      };
  }

  function renderAll() {
    ensureListsContainState();
    renderHeader();
    renderImportPanel();
    renderItems();
    renderSoMatrix();
    renderCloMatrix();
    renderIce();
    renderApprovals();
    renderComputed();
  }

  async function persistConfig() {
    try {
      await storageBackend.set(CONFIG_KEY, JSON.stringify(config), true);
    } catch (e) {}
  }
  async function loadConfig() {
    try {
      const got = await storageBackend.get(CONFIG_KEY, true);
      if (got && got.value) {
        config = JSON.parse(got.value);
      }
    } catch (e) {
      /* use defaults */
    }
  }

  async function saveSemester() {
    if (!state.meta.course || !state.meta.semester) {
      setSaveMsg("Choose a course and semester first.");
      return;
    }
    try {
      const key = storeKey(state.meta);
      const res = await storageBackend.set(key, JSON.stringify(state), true);
      setSaveMsg(
        res
          ? "Saved " +
              new Date().toLocaleTimeString() +
              " — visible to your whole team"
          : "Save failed — try again.",
      );
      refreshSavedList();
    } catch (err) {
      setSaveMsg("Save failed: " + err.message);
    }
  }

  async function refreshSavedList() {
    const el = document.getElementById("saved-list");
    if (!el) return;
    try {
      const res = await storageBackend.list(STORE_PREFIX, true);
      const keys = res && res.keys ? res.keys : [];
      if (keys.length === 0) {
        el.innerHTML = '<div class="note">No saved semesters yet.</div>';
        return;
      }
      const chips = [];
      for (const k of keys) {
        try {
          const got = await storageBackend.get(k, true);
          if (got && got.value) {
            const s = JSON.parse(got.value);
            chips.push({
              key: k,
              label:
                esc(s.meta.program) +
                " &middot; " +
                esc(s.meta.course) +
                " &middot; " +
                esc(s.meta.semester) +
                (s.locked ? " &#128274;" : ""),
            });
          }
        } catch (e) {}
      }
      el.innerHTML =
        '<div class="note" style="margin-top:12px">Saved semesters (shared with your whole team):</div><div class="chip-row">' +
        chips
          .map(
            (c) =>
              `<span class="chip"><span data-load="${esc(c.key)}" style="cursor:pointer">${c.label}</span><button class="ghost" data-del="${esc(c.key)}">&#10005;</button></span>`,
          )
          .join("") +
        "</div>";
      el.querySelectorAll("[data-load]").forEach((span) => {
        span.onclick = async () => {
          try {
            const got = await storageBackend.get(span.dataset.load, true);
            if (got && got.value) {
              state = JSON.parse(got.value);
              renderAll();
              setSaveMsg("Loaded.");
            }
          } catch (err) {
            setSaveMsg("Could not load that semester.");
          }
        };
      });
      el.querySelectorAll("[data-del]").forEach((btn) => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          if (!confirm("Delete this saved record for everyone on the team?"))
            return;
          try {
            await storageBackend.delete(btn.dataset.del, true);
            refreshSavedList();
          } catch (err) {}
        };
      });
    } catch (err) {
      el.innerHTML = '<div class="note">Could not load saved semesters.</div>';
    }
  }

  // ============================================================
  // SAT — Semester Assessment Tool
  // Compiles every course in a program's official list into one semester-wide
  // view: automatically wherever a matching CAT has already been saved, and
  // manually (typed numbers, or a direct Excel upload) everywhere else.
  // ============================================================
  let mode = "cat";
  let satState = null;
  let satImportedWorkbook = null;

  function satRowBlank() {
    return {
      so: new Array(7).fill(null),
      clos: [],
      cloLabels: [],
      remarks: {
        issuesPrev: "",
        issuesCurrent: "",
        actionPlan: "",
      },
      instructor: "",
      enrolled: null,
      source: null,
      updatedAt: null,
    };
  }
  function satStoreKey(program, semester) {
    return "sat:" + slug(program) + ":" + slug(semester);
  }

  function freshSatState(program, semester) {
    const rows = {};
    (config.coursesByProgram[program] || []).forEach((course) => {
      rows[course] = satRowBlank();
    });
    return { program, semester, rows };
  }

  async function loadSat(program, semester) {
    const fresh = freshSatState(program, semester);
    try {
      const got = await storageBackend.get(
        satStoreKey(program, semester),
        true,
      );
      if (got && got.value) {
        const saved = JSON.parse(got.value);
        Object.keys(fresh.rows).forEach((course) => {
          if (saved[course]) fresh.rows[course] = saved[course];
        });
      }
    } catch (e) {
      /* nothing saved yet */
    }
    satState = fresh;
  }

  async function saveSat() {
    if (!satState) return;
    try {
      await storageBackend.set(
        satStoreKey(satState.program, satState.semester),
        JSON.stringify(satState.rows),
        true,
      );
      setSatMsg(
        "Saved " +
          new Date().toLocaleTimeString() +
          " — visible to your whole team",
      );
    } catch (e) {
      setSatMsg("Save failed: " + e.message);
    }
  }

  // Same weighting rule as computeOutcome, but operating on an arbitrary saved
  // or imported items array rather than the live CAT being edited on-screen.
  function outcomeFromItems(items, key, idx) {
    let sumWeighted = 0,
      sumWeight = 0,
      n = 0;
    (items || []).forEach((it) => {
      if (it[key] && it[key][idx]) {
        const max = Number(it.max) || 0,
          weight = Number(it.weight) || 0;
        if (max > 0) {
          sumWeighted += ((Number(it.avg) || 0) / max) * weight;
          sumWeight += weight;
          n++;
        }
      }
    });
    if (n === 0 || sumWeight === 0) return null;
    return (sumWeighted / sumWeight) * 100;
  }

  async function refreshCourseFromCat(course, force) {
    const row = satState.rows[course];
    if (row.source === "manual" && !force) return false;
    try {
      const key = storeKey({
        program: satState.program,
        course,
        semester: satState.semester,
      });
      const got = await storageBackend.get(key, true);
      if (!got || !got.value) return false;
      const cat = JSON.parse(got.value);
      const so = SOS.map((_, i) => outcomeFromItems(cat.items, "so", i));
      const clos = (cat.clos || []).map((_, i) =>
        outcomeFromItems(cat.items, "clo", i),
      );
      satState.rows[course] = {
        so,
        clos,
        cloLabels: cat.clos || [],
        remarks: cat.ice
          ? {
              issuesPrev: cat.ice.issuesPrev || "",
              issuesCurrent: cat.ice.issuesCurrent || "",
              actionPlan: cat.ice.actionPlan || "",
            }
          : {
              issuesPrev: "",
              issuesCurrent: "",
              actionPlan: "",
            },
        instructor:
          (cat.approvals &&
            cat.approvals.instructor &&
            cat.approvals.instructor.name) ||
          "",
        enrolled: (cat.roster && cat.roster.length) || null,
        source: "auto",
        updatedAt: Date.now(),
      };
      return true;
    } catch (e) {
      return false;
    }
  }

  async function refreshAllFromCats() {
    const courses = Object.keys(satState.rows);
    let found = 0;
    for (const course of courses) {
      if (await refreshCourseFromCat(course, false)) found++;
    }
    renderSatAll();
    setSatMsg(
      found +
        " of " +
        courses.length +
        " courses pulled automatically from saved CATs (courses you\u2019ve edited manually here were left alone).",
    );
  }

  function setSatMsg(m) {
    const el = document.getElementById("sat-save-msg");
    if (el) el.textContent = m;
  }

  function renderSatHeader() {
    const el = document.getElementById("sat-blk-header");
    el.innerHTML = `
<div class="eyebrow no-print">Department of Mechanical Engineering</div>
<h1>Semester Assessment Tool (SAT)</h1>
<div class="sub no-print">Compiles every course's CAT into one program-wide view for the semester &mdash; automatically wherever a CAT's already been saved, manually everywhere else.</div>
<div class="print-only sub">${esc(satState.program)} &middot; ${esc(satState.semester)}</div>
<div class="grid3 no-print" style="margin-top:16px">
<div><label class="field-label">Program</label><select id="sat-f-program">${PROGRAMS.map((p) => `<option value="${esc(p)}" ${p === satState.program ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></div>
<div><label class="field-label">Semester</label><select id="sat-f-semester">${config.semesters.map((s) => `<option value="${esc(s)}" ${s === satState.semester ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></div>
<div style="align-self:end"><button class="primary" id="sat-btn-refresh">Refresh from CATs</button></div>
</div>
<div class="row no-print" style="margin-top:14px">
<button id="sat-btn-save">Save this semester</button>
<button id="sat-btn-print">Print / Save as PDF</button>
<span class="savemsg" id="sat-save-msg"></span>
</div>
<div class="stat-strip no-print" id="sat-stat-strip"></div>
`;
    document.getElementById("sat-f-program").onchange = async (e) => {
      await loadSat(e.target.value, satState.semester);
      renderSatAll();
    };
    document.getElementById("sat-f-semester").onchange = async (e) => {
      await loadSat(satState.program, e.target.value);
      renderSatAll();
    };
    document.getElementById("sat-btn-refresh").onclick = refreshAllFromCats;
    document.getElementById("sat-btn-save").onclick = saveSat;
    document.getElementById("sat-btn-print").onclick = () => window.print();
  }

  let satBulkWorkbook = null;

  function renderSatImportPanel() {
    const el = document.getElementById("sat-blk-import");
    const courses = Object.keys(satState.rows);
    el.innerHTML = `
<h2>Import from the department SAT workbook</h2>
<div class="sub">Upload the master semester workbook (one row per course) and pick a semester tab &mdash; every course on it that matches your program's course list is filled in at once, and the program average recalculates automatically.</div>
<div class="grid3" style="margin-top:10px">
<div style="grid-column:span 2"><label class="field-label">File</label><input type="file" id="sat-bulk-file" accept=".xlsx,.xlsm,.xls"></div>
<div id="sat-bulk-sheet-picker"></div>
</div>
<div id="sat-bulk-status" class="note"></div>

<div style="margin-top:20px; padding-top:16px; border-top:1px dashed var(--line)">
<h2 style="font-size:15px">Or add one course from its own CAT file</h2>
<div class="sub">For a course that hasn't gone through the department workbook yet.</div>
<div class="grid3" style="margin-top:10px">
  <div><label class="field-label">Course</label><select id="sat-import-course">${courses.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}</select></div>
  <div><label class="field-label">File</label><input type="file" id="sat-import-file" accept=".xlsx,.xlsm,.xls"></div>
  <div id="sat-import-sheet-picker"></div>
</div>
<div id="sat-import-status" class="note"></div>
</div>
`;
    document.getElementById("sat-bulk-file").onchange = handleSatBulkImportFile;
    document.getElementById("sat-import-file").onchange = handleSatImportFile;
  }

  // The department SAT workbook lists SO1-7 and CLO1-12 as single numbers per
  // course, one row per course, on a sheet named like "Fall 2024-2025". Column
  // positions are fixed by that template: B=code, C=title, L=instructor,
  // AG/AI/AK/AM/AO/AQ/AS=SO1-7, AU/AW/.../BQ=CLO1-12, CR/CS/CT=remarks.
  function parseSatWorkbookSheet(rows) {
    const CODE_COL = 1,
      TITLE_COL = 2,
      INSTRUCTOR_COL = 11;
    const SO_COLS = [32, 34, 36, 38, 40, 42, 44];
    const CLO_COLS = [46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68];
    const REMARK_COLS = {
      issuesPrev: 95,
      issuesCurrent: 96,
      actionPlan: 97,
    };
    function blankToNull(v) {
      if (v === "" || v === undefined || v === null) return null;
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    }
    const out = [];
    for (let r = 4; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const code = String(row[CODE_COL] || "").trim();
      if (!code) continue;
      if (/^totals?\b/i.test(code)) break;
      const so = SO_COLS.map((c) => blankToNull(row[c]));
      const clos = CLO_COLS.map((c) => blankToNull(row[c]));
      if (!so.some((v) => v !== null) && !clos.some((v) => v !== null))
        continue; // no SO/CLO data this semester
      out.push({
        code,
        title: String(row[TITLE_COL] || "").trim(),
        so,
        clos,
        instructor: String(row[INSTRUCTOR_COL] || "").trim(),
        remarks: {
          issuesPrev: String(row[REMARK_COLS.issuesPrev] || "").trim(),
          issuesCurrent: String(row[REMARK_COLS.issuesCurrent] || "").trim(),
          actionPlan: String(row[REMARK_COLS.actionPlan] || "").trim(),
        },
      });
    }
    return out;
  }

  async function handleSatBulkImportFile(e) {
    const file = e.target.files[0];
    const statusEl = document.getElementById("sat-bulk-status");
    const pickerEl = document.getElementById("sat-bulk-sheet-picker");
    pickerEl.innerHTML = "";
    if (!file) return;
    if (typeof XLSX === "undefined") {
      statusEl.textContent =
        "Still loading the Excel reader — wait a moment and choose the file again.";
      return;
    }
    statusEl.textContent = "Reading " + file.name + " …";
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      satBulkWorkbook = wb;
      const semesterSheets = wb.SheetNames.filter((n) =>
        /^(fall|spring)\s+\d{4}-\d{4}/i.test(n.trim()),
      );
      if (semesterSheets.length === 0) {
        statusEl.textContent =
          'No semester tabs found — expected sheet names like "Fall 2024-2025".';
        return;
      }
      pickerEl.innerHTML = `<label class="field-label">Semester tab</label><select id="sat-bulk-sheet">${semesterSheets.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select><div class="row" style="margin-top:8px"><button class="primary" id="sat-btn-do-bulk-import">Import all matching courses</button></div>`;
      document.getElementById("sat-btn-do-bulk-import").onclick = () =>
        doSatBulkImport(document.getElementById("sat-bulk-sheet").value);
      statusEl.textContent =
        "Found " +
        semesterSheets.length +
        " semester tab(s) — pick one and import.";
    } catch (err) {
      statusEl.textContent = "Could not read that file: " + err.message;
    }
  }

  function doSatBulkImport(sheetName) {
    const statusEl = document.getElementById("sat-bulk-status");
    try {
      const ws = satBulkWorkbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: "",
      });
      const parsedRows = parseSatWorkbookSheet(rows);
      if (parsedRows.length === 0) {
        statusEl.textContent = 'No SO/CLO data found on "' + sheetName + '".';
        return;
      }

      const codeToLabel = {};
      Object.keys(satState.rows).forEach((label) => {
        codeToLabel[label.split(" ")[0].toUpperCase()] = label;
      });

      let matched = 0;
      parsedRows.forEach((pr) => {
        const label = codeToLabel[pr.code.toUpperCase()];
        if (!label) return;
        matched++;
        const cloLib = config.closByCourse[label];
        const cloLabels = Array.from(
          { length: 12 },
          (_, i) => (cloLib && cloLib[i]) || "CLO " + (i + 1),
        );
        satState.rows[label] = {
          so: pr.so,
          clos: pr.clos,
          cloLabels,
          remarks: pr.remarks,
          instructor: pr.instructor,
          enrolled:
            (satState.rows[label] && satState.rows[label].enrolled) || null,
          source: "imported",
          updatedAt: Date.now(),
        };
      });
      renderSatAll();
      setSatMsg(
        "Imported " +
          matched +
          " of " +
          parsedRows.length +
          ' courses with data from "' +
          sheetName +
          '" (matched against your ' +
          Object.keys(satState.rows).length +
          "-course list).",
      );
    } catch (err) {
      statusEl.textContent = "Import failed: " + err.message;
    }
  }

  async function handleSatImportFile(e) {
    const file = e.target.files[0];
    const statusEl = document.getElementById("sat-import-status");
    const pickerEl = document.getElementById("sat-import-sheet-picker");
    pickerEl.innerHTML = "";
    if (!file) return;
    if (typeof XLSX === "undefined") {
      statusEl.textContent =
        "Still loading the Excel reader — wait a moment and choose the file again.";
      return;
    }
    statusEl.textContent = "Reading " + file.name + " …";
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      satImportedWorkbook = wb;
      const dataSheets = wb.SheetNames.filter((n) => {
        const low = n.toLowerCase().trim();
        return (
          low.slice(-3) !== "(s)" &&
          low.indexOf("template") !== 0 &&
          low !== "student outcomes" &&
          low !== "grading criteria"
        );
      });
      if (dataSheets.length === 0) {
        statusEl.textContent = "No semester tabs found in this workbook.";
        return;
      }
      pickerEl.innerHTML = `<label class="field-label">Semester tab</label><select id="sat-import-sheet">${dataSheets.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select><div class="row" style="margin-top:8px"><button class="primary" id="sat-btn-do-import">Import</button></div>`;
      document.getElementById("sat-btn-do-import").onclick = doSatImport;
      statusEl.textContent =
        "Found " + dataSheets.length + " tab(s) — pick one and import.";
    } catch (err) {
      statusEl.textContent = "Could not read that file: " + err.message;
    }
  }

  function doSatImport() {
    const statusEl = document.getElementById("sat-import-status");
    const course = document.getElementById("sat-import-course").value;
    const sheetName = document.getElementById("sat-import-sheet").value;
    try {
      const ws = satImportedWorkbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: "",
      });
      const isNew =
        String((rows[4] || [])[2] || "")
          .trim()
          .toLowerCase() === "student no.";
      const parsed = isNew
        ? parseNewTemplate(rows, ws)
        : parseOldTemplate(rows);
      if (!parsed) {
        statusEl.textContent =
          'Could not recognize the layout of "' + sheetName + '".';
        return;
      }
      const cloLib = config.closByCourse[course];
      const cloLabels = Array.from(
        { length: parsed.cloCount },
        (_, i) => (cloLib && cloLib[i]) || "CLO " + (i + 1),
      );
      const so = SOS.map((_, i) => outcomeFromItems(parsed.items, "so", i));
      const clos = cloLabels.map((_, i) =>
        outcomeFromItems(parsed.items, "clo", i),
      );
      satState.rows[course] = {
        so,
        clos,
        cloLabels,
        remarks: {
          issuesPrev: "",
          issuesCurrent: "",
          actionPlan: "",
        },
        instructor: "",
        enrolled: parsed.roster ? parsed.roster.length : null,
        source: "imported",
        updatedAt: Date.now(),
      };
      renderSatAll();
      setSatMsg("Imported " + course + ' from "' + sheetName + '".');
    } catch (err) {
      statusEl.textContent = "Import failed: " + err.message;
    }
  }

  function satBadge(source) {
    if (source === "auto") return '<span class="pill ok">Auto</span>';
    if (source === "imported") return '<span class="pill ok">Imported</span>';
    if (source === "manual")
      return '<span class="pill low" style="background:var(--accent-tint);color:var(--accent-dark)">Manual</span>';
    return '<span class="pill na">Not yet entered</span>';
  }

  function renderSatTable() {
    const el = document.getElementById("sat-blk-table");
    const courses = Object.keys(satState.rows);
    el.innerHTML = `
<h2>Courses this semester</h2>
<div class="sub">Auto-pulled from a saved CAT where one exists; otherwise import a file above or type a number directly — typing a value marks that course Manual so a later refresh won't overwrite it.</div>
<div class="wrap-x">
<table>
  <tr><th style="width:22%">Course</th><th>Status</th>${SOS.map((_, i) => `<th style="text-align:center">SO${i + 1}</th>`).join("")}<th></th></tr>
  ${courses
    .map((course) => {
      const row = satState.rows[course];
      return `<tr>
      <td>${esc(course)}</td>
      <td>${satBadge(row.source)}</td>
      ${row.so.map((v, i) => `<td style="text-align:center"><input type="number" step="0.1" data-role="satso" data-course="${esc(course)}" data-i="${i}" value="${v === null ? "" : Math.round(v)}" style="width:64px;text-align:center;${v !== null && !meetsThreshold(v) ? "color:var(--warn);font-weight:600" : ""}"></td>`).join("")}
      <td><button class="ghost" data-role="satdetail" data-course="${esc(course)}" style="font-size:11px">Detail</button></td>
    </tr>`;
    })
    .join("")}
</table>
</div>
`;
    el.querySelectorAll("[data-role=satso]").forEach((inp) => {
      inp.oninput = (e) => {
        const course = e.target.dataset.course,
          i = +e.target.dataset.i;
        const raw = e.target.value;
        const v = raw === "" ? null : parseFloat(raw);
        satState.rows[course].so[i] = v === null || isNaN(v) ? null : v;
        satState.rows[course].source = "manual";
        satState.rows[course].updatedAt = Date.now();
        renderSatChart();
      };
    });
    el.querySelectorAll("[data-role=satdetail]").forEach((btn) => {
      btn.onclick = () => renderSatDetail(btn.dataset.course);
    });
  }

  function satProgramAverage(idx) {
    const vals = Object.values(satState.rows)
      .map((r) => r.so[idx])
      .filter((v) => v !== null && v !== undefined);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function renderSatChart() {
    const el = document.getElementById("sat-chart-body");
    if (!el) return;
    el.innerHTML = barChartSVG(
      SOS.map((t, i) => ({
        label: "SO" + (i + 1) + " — " + t,
        value: satProgramAverage(i),
      })),
    );
  }

  function renderSatDetail(course) {
    const el = document.getElementById("sat-blk-detail");
    const row = satState.rows[course];
    const metaBits = [];
    if (row.instructor) metaBits.push("Instructor: " + esc(row.instructor));
    if (row.enrolled) metaBits.push(row.enrolled + " students");
    if (row.updatedAt)
      metaBits.push("Updated " + new Date(row.updatedAt).toLocaleDateString());
    const cloBlock = row.cloLabels.length
      ? row.cloLabels
          .map((name, i) =>
            ledgerRow(String(i + 1), name, {
              value: row.clos[i],
              n: row.clos[i] !== null ? 1 : 0,
            }),
          )
          .join("")
      : '<div class="note">No CLO detail available for this course yet.</div>';
    const hasRemarks =
      row.remarks.issuesPrev ||
      row.remarks.issuesCurrent ||
      row.remarks.actionPlan;
    el.innerHTML = `
<h2>${esc(course)}</h2>
<div class="sub">${metaBits.join(" &middot; ")}</div>
<div style="margin-top:12px">${cloBlock}</div>
${
  hasRemarks
    ? `<div style="margin-top:16px">
${row.remarks.issuesPrev ? `<div class="sub"><strong>Issues, previous offering:</strong> ${esc(row.remarks.issuesPrev)}</div>` : ""}
${row.remarks.issuesCurrent ? `<div class="sub" style="margin-top:6px"><strong>Issues, this offering:</strong> ${esc(row.remarks.issuesCurrent)}</div>` : ""}
${row.remarks.actionPlan ? `<div class="sub" style="margin-top:6px"><strong>Action plan:</strong> ${esc(row.remarks.actionPlan)}</div>` : ""}
</div>`
    : ""
}
`;
  }

  async function renderSatAll() {
    renderSatHeader();
    renderSatImportPanel();
    renderSatTable();
    renderSatChart();
    const detailEl = document.getElementById("sat-blk-detail");
    if (detailEl) detailEl.innerHTML = "";
    const stat = document.getElementById("sat-stat-strip");
    if (stat) {
      const rows = Object.values(satState.rows);
      const withData = rows.filter((r) => r.so.some((v) => v !== null)).length;
      stat.innerHTML = `<div class="stat"><div class="num mono">${withData}/${rows.length}</div><div class="lbl">Courses reporting</div></div>`;
    }
  }

  function setMode(m) {
    mode = m;
    document.getElementById("dcat-root").style.display =
      m === "cat" ? "" : "none";
    document.getElementById("sat-root").style.display =
      m === "sat" ? "" : "none";
    document.getElementById("mode-btn-cat").className =
      m === "cat" ? "primary" : "";
    document.getElementById("mode-btn-sat").className =
      m === "sat" ? "primary" : "";
  }

  (async function init() {
    await loadConfig();
    renderAll();
    await loadSat(PROGRAMS[0], config.semesters[0] || "Fall 2025-2026");
    await renderSatAll();
    document.getElementById("mode-btn-cat").onclick = () => setMode("cat");
    document.getElementById("mode-btn-sat").onclick = () => setMode("sat");
  })();
})();
